import path from 'path';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import _generator from '@babel/generator';
import { addNamed } from '@babel/helper-module-imports';
import { xxHash32 } from './xxhash32';
import type { RuntimeType } from '../shared/types';

// https://github.com/babel/babel/issues/15269
let generator: typeof _generator;
if (typeof _generator !== 'function') {
  generator = (_generator as any).default;
} else {
  generator = _generator;
}

const CWD = process.cwd();

function getFile(filename: string) {
  return path.relative(CWD, filename);
}

interface Options {
  bundler?: RuntimeType;
  fixRender?: boolean;
  imports?: ImportIdentity[];
}

type ImportHook = Map<string, t.Identifier>;

interface ImportIdentifiers {
  identifiers: Map<t.Identifier, ImportIdentity>;
  namespaces: Map<t.Identifier, ImportIdentity[]>;
}

interface State extends babel.PluginPass {
  hooks: ImportHook;
  opts: Options;
  processed: boolean;
  granular: boolean;
  registrations: ImportIdentifiers;
  fixRender?: boolean;
  imports: ImportIdentity[];
}

// This is just a Pascal heuristic
// we only assume a function is a component
// if the first character is in uppercase
function isComponentishName(name: string) {
  return name[0] >= 'A' && name[0] <= 'Z';
}

function isESMHMR(bundler: Options['bundler']) {
  // The currently known ESM HMR implementations
  // esm - the original ESM HMR Spec
  // vite - Vite's implementation
  return bundler === 'esm' || bundler === 'vite';
}

// Source of solid-refresh (for import)
const SOLID_REFRESH_MODULE = 'solid-refresh';

// Exported names from solid-refresh that will be imported
const IMPORTS = {
  registry: '$$registry',
  refresh: '$$refresh',
  component: '$$component',
  context: '$$context',
  decline: '$$decline',
};

function getSolidRefreshIdentifier(
  state: State,
  path: babel.NodePath,
  name: string,
): t.Identifier {
  const target = `${name}`;
  const current = state.hooks.get(target);
  if (current) {
    return current;
  }
  const newID = addNamed(path, name, SOLID_REFRESH_MODULE);
  state.hooks.set(target, newID);
  return newID;
}

function getHotIdentifier(state: State): t.MemberExpression {
  const bundler = state.opts.bundler;
  // vite/esm uses `import.meta.hot`
  if (isESMHMR(bundler)) {
    return t.memberExpression(
      t.memberExpression(t.identifier('import'), t.identifier('meta')),
      t.identifier('hot'),
    );
  }
  // webpack 5 uses `import.meta.webpackHot`
  // rspack does as well
  if (bundler === 'webpack5' || bundler === 'rspack-esm') {
    return t.memberExpression(
      t.memberExpression(t.identifier('import'), t.identifier('meta')),
      t.identifier('webpackHot'),
    );
  }
  // `module.hot` is the default.
  return t.memberExpression(t.identifier('module'), t.identifier('hot'));
}

function generateViteRequirement(
  state: State,
  statements: t.Statement[],
  pathToHot: t.Expression,
) {
  if (state.opts.bundler === 'vite') {
    // Vite requires that the owner module has an `import.meta.hot.accept()` call
    statements.push(
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(pathToHot, t.identifier('accept')),
          [],
        ),
      ),
    );
  }
}

function getHMRDeclineCall(state: State, path: babel.NodePath) {
  const pathToHot = getHotIdentifier(state);
  const statements = [
    t.expressionStatement(
      t.callExpression(
        getSolidRefreshIdentifier(state, path, IMPORTS.decline),
        [t.stringLiteral(state.opts.bundler ?? 'standard'), pathToHot],
      ),
    ),
  ];

  generateViteRequirement(state, statements, pathToHot);

  return t.ifStatement(pathToHot, t.blockStatement(statements));
}

function getStatementPath(path: babel.NodePath): babel.NodePath | null {
  if (t.isStatement(path.node)) {
    return path;
  }
  if (path.parentPath) {
    return getStatementPath(path.parentPath);
  }
  return null;
}

const REGISTRY = 'REGISTRY';

function createRegistry(state: State, path: babel.NodePath): t.Identifier {
  const current = state.hooks.get(REGISTRY);
  if (current) {
    return current;
  }
  const program = path.scope.getProgramParent();
  const identifier = program.generateUidIdentifier(REGISTRY);
  program.push({
    id: identifier,
    kind: 'const',
    init: t.callExpression(
      getSolidRefreshIdentifier(state, path, IMPORTS.registry),
      [],
    ),
  });
  const pathToHot = getHotIdentifier(state);
  const statements: t.Statement[] = [
    t.expressionStatement(
      t.callExpression(
        getSolidRefreshIdentifier(state, path, IMPORTS.refresh),
        [
          t.stringLiteral(state.opts.bundler ?? 'standard'),
          pathToHot,
          identifier,
        ],
      ),
    ),
  ];

  generateViteRequirement(state, statements, pathToHot);

  (program.path as babel.NodePath<t.Program>).pushContainer('body', [
    t.ifStatement(pathToHot, t.blockStatement(statements)),
  ]);
  state.hooks.set(REGISTRY, identifier);
  return identifier;
}

function createSignatureValue(node: t.Node): string {
  const code = generator(node);
  const result = xxHash32(code.code).toString(16);
  return result;
}

function isForeignBinding(
  source: babel.NodePath,
  current: babel.NodePath,
  name: string,
): boolean {
  if (source === current) {
    return true;
  }
  if (current.scope.hasOwnBinding(name)) {
    return false;
  }
  if (current.parentPath) {
    return isForeignBinding(source, current.parentPath, name);
  }
  return true;
}

function isInTypescript(path: babel.NodePath): boolean {
  let parent = path.parentPath;
  while (parent) {
    if (t.isTypeScript(parent.node) && !t.isExpression(parent.node)) {
      return true;
    }
    parent = parent.parentPath;
  }
  return false;
}

function isIdentifierReserved(node: t.Identifier) {
  switch (node.name) {
    case 'undefined':
    case 'NaN':
    case 'Infinity':
      return true;
    default:
      return false;
  }
}

function getBindings(path: babel.NodePath): t.Identifier[] {
  const identifiers = new Set<string>();
  path.traverse({
    Expression(p) {
      // Check identifiers that aren't in a TS expression
      if (
        t.isIdentifier(p.node) &&
        !isIdentifierReserved(p.node) &&
        !isInTypescript(p) &&
        isForeignBinding(path, p, p.node.name)
      ) {
        identifiers.add(p.node.name);
      }
      // for the JSX, only use JSXMemberExpression's object
      // as a foreign binding
      if (
        t.isJSXElement(p.node) &&
        t.isJSXMemberExpression(p.node.openingElement.name)
      ) {
        let base: t.JSXMemberExpression | t.JSXIdentifier =
          p.node.openingElement.name;
        while (t.isJSXMemberExpression(base)) {
          base = base.object;
        }
        if (isForeignBinding(path, p, base.name)) {
          identifiers.add(base.name);
        }
      }
    },
  });
  const collected = [];
  for (const identifier of identifiers) {
    collected.push(t.identifier(identifier));
  }
  return collected;
}

interface ImportIdentity {
  name: string;
  source: string;
  kind: 'named' | 'default';
  type: 'createContext' | 'render';
}

const IMPORT_IDENTITIES: ImportIdentity[] = [
  {
    type: 'createContext',
    name: 'createContext',
    kind: 'named',
    source: 'solid-js',
  },
  {
    type: 'createContext',
    name: 'createContext',
    kind: 'named',
    source: 'solid-js/web',
  },
  { type: 'render', name: 'render', kind: 'named', source: 'solid-js/web' },
  { type: 'render', name: 'hydrate', kind: 'named', source: 'solid-js/web' },
];

function getImportSpecifierName(specifier: t.ImportSpecifier): string {
  switch (specifier.imported.type) {
    case 'Identifier':
      return specifier.imported.name;
    case 'StringLiteral':
      return specifier.imported.value;
    default:
      return '';
  }
}

function registerImportSpecifier(
  state: State,
  id: ImportIdentity,
  specifier:
    | t.ImportDefaultSpecifier
    | t.ImportNamespaceSpecifier
    | t.ImportSpecifier,
) {
  switch (specifier.type) {
    case 'ImportDefaultSpecifier': {
      if (id.kind === 'default') {
        state.registrations.identifiers.set(specifier.local, id);
      }
      break;
    }
    case 'ImportSpecifier': {
      if (
        (id.kind === 'named' &&
          getImportSpecifierName(specifier) === id.name) ||
        (id.kind === 'default' &&
          getImportSpecifierName(specifier) === 'default')
      ) {
        state.registrations.identifiers.set(specifier.local, id);
      }
      break;
    }
    case 'ImportNamespaceSpecifier': {
      let current = state.registrations.namespaces.get(specifier.local);
      if (!current) {
        current = [];
      }
      current.push(id);
      state.registrations.namespaces.set(specifier.local, current);
      break;
    }
    default:
      break;
  }
}

function registerImportSpecifiers(
  state: State,
  p: babel.NodePath<t.ImportDeclaration>,
) {
  for (let i = 0, len = state.imports.length; i < len; i++) {
    const id = state.imports[i];
    if (p.node.source.value === id.source) {
      for (let k = 0, klen = p.node.specifiers.length; k < klen; k++) {
        registerImportSpecifier(state, id, p.node.specifiers[k]);
      }
    }
  }
}

function captureIdentifiers(state: State, path: babel.NodePath) {
  path.traverse({
    ImportDeclaration(p) {
      if (p.node.importKind === 'value') {
        registerImportSpecifiers(state, p);
      }
    },
  });
}

type TypeFilter<K extends t.Expression> = (node: t.Expression) => node is K;
type TypeCheck<K> = K extends TypeFilter<infer U> ? U : never;

function unwrapExpression<K extends (node: t.Expression) => boolean>(
  node: t.Expression,
  key: K,
): TypeCheck<K> | undefined {
  switch (node.type) {
    case 'ParenthesizedExpression':
    case 'TypeCastExpression':
    case 'TSAsExpression':
    case 'TSSatisfiesExpression':
    case 'TSNonNullExpression':
    case 'TSInstantiationExpression':
    case 'TSTypeAssertion':
      return unwrapExpression(node.expression, key);
    default:
      return key(node) ? (node as TypeCheck<K>) : undefined;
  }
}

function isIdentifierValidCallee(
  state: State,
  path: babel.NodePath,
  callee: t.Identifier,
  target: ImportIdentity['type'],
): boolean {
  const binding = path.scope.getBindingIdentifier(callee.name);
  if (binding) {
    const result = state.registrations.identifiers.get(binding);
    if (result && result.type === target) {
      return true;
    }
  }
  return false;
}

function isPropertyValidCallee(
  result: ImportIdentity[],
  target: ImportIdentity['type'],
  propName: string,
): boolean {
  for (let i = 0, len = result.length; i < len; i++) {
    const registration = result[i];
    if (registration.type === target) {
      if (registration.kind === 'default') {
        if (propName === 'default') {
          return true;
        }
      } else if (
        registration.kind === 'named' &&
        registration.name === propName
      ) {
        return true;
      }
    }
  }
  return false;
}

function isMemberExpressionValidCallee(
  state: State,
  path: babel.NodePath,
  member: t.MemberExpression,
  target: ImportIdentity['type'],
): boolean {
  if (!t.isIdentifier(member.property)) {
    return false;
  }
  const trueObject = unwrapExpression(member.object, t.isIdentifier);
  if (!trueObject) {
    return false;
  }
  const binding = path.scope.getBindingIdentifier(trueObject.name);
  if (!binding) {
    return false;
  }
  const result = state.registrations.namespaces.get(binding);
  if (!result) {
    return false;
  }
  return isPropertyValidCallee(result, target, member.property.name);
}

function isValidCallee(
  state: State,
  path: babel.NodePath,
  { callee }: t.CallExpression,
  target: ImportIdentity['type'],
) {
  if (t.isV8IntrinsicIdentifier(callee)) {
    return false;
  }
  const trueCallee = unwrapExpression(callee, t.isIdentifier);
  if (trueCallee) {
    return isIdentifierValidCallee(state, path, trueCallee, target);
  }
  const trueMember = unwrapExpression(callee, t.isMemberExpression);
  if (trueMember && !trueMember.computed) {
    return isMemberExpressionValidCallee(state, path, trueMember, target);
  }

  return false;
}

function checkValidRenderCall(path: babel.NodePath): boolean {
  let currentPath = path.parentPath;

  while (currentPath) {
    if (t.isProgram(currentPath.node)) {
      return true;
    }
    if (!t.isStatement(currentPath.node)) {
      return false;
    }
    currentPath = currentPath.parentPath;
  }

  return false;
}

function fixRenderCalls(state: State, path: babel.NodePath<t.Program>) {
  path.traverse({
    ExpressionStatement(p) {
      const trueCallExpr = unwrapExpression(
        p.node.expression,
        t.isCallExpression,
      );
      if (
        trueCallExpr &&
        checkValidRenderCall(p) &&
        isValidCallee(state, p, trueCallExpr, 'render')
      ) {
        // Replace with variable declaration
        const id = p.scope.generateUidIdentifier('cleanup');
        p.replaceWith(
          t.variableDeclaration('const', [
            t.variableDeclarator(id, p.node.expression),
          ]),
        );
        const pathToHot = getHotIdentifier(state);
        p.insertAfter(
          t.ifStatement(
            pathToHot,
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(pathToHot, t.identifier('dispose')),
                [id],
              ),
            ),
          ),
        );
        p.skip();
      }
    },
  });
}

function wrapComponent(
  state: State,
  path: babel.NodePath,
  identifier: t.Identifier,
  component: t.FunctionExpression | t.ArrowFunctionExpression,
  original: t.Node = component,
) {
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registry = createRegistry(state, statementPath);
    const hotName = t.stringLiteral(identifier.name);
    const componentCall = getSolidRefreshIdentifier(
      state,
      statementPath,
      IMPORTS.component,
    );
    const properties: t.ObjectProperty[] = [];
    if (state.filename && original.loc) {
      const filePath = getFile(state.filename);
      properties.push(
        t.objectProperty(
          t.identifier('location'),
          t.stringLiteral(
            `${filePath}:${original.loc.start.line}:${original.loc.start.column}`,
          ),
        ),
      );
    }
    if (state.granular) {
      properties.push(
        t.objectProperty(
          t.identifier('signature'),
          t.stringLiteral(createSignatureValue(component)),
        ),
      );
      const dependencies = getBindings(path);
      if (dependencies.length) {
        const dependencyKeys: t.ObjectProperty[] = [];
        let id: t.Identifier;
        for (let i = 0, len = dependencies.length; i < len; i++) {
          id = dependencies[i];
          dependencyKeys.push(t.objectProperty(id, id, false, true));
        }
        properties.push(
          t.objectProperty(
            t.identifier('dependencies'),
            t.objectExpression(dependencyKeys),
          ),
        );
      }
      return t.callExpression(componentCall, [
        registry,
        hotName,
        component,
        t.objectExpression(properties),
      ]);
    }
    return t.callExpression(componentCall, [
      registry,
      hotName,
      component,
      ...(properties.length ? [t.objectExpression(properties)] : []),
    ]);
  }
  return component;
}

function wrapContext(
  state: State,
  path: babel.NodePath,
  identifier: t.Identifier,
  context: t.CallExpression,
) {
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registry = createRegistry(state, statementPath);
    const hotName = t.stringLiteral(identifier.name);
    const contextCall = getSolidRefreshIdentifier(
      state,
      statementPath,
      IMPORTS.context,
    );

    return t.callExpression(contextCall, [registry, hotName, context]);
  }
  return context;
}

function setupProgram(state: State, path: babel.NodePath<t.Program>): void {
  let shouldSkip = false;
  const comments = state.file.ast.comments;
  if (comments) {
    for (let i = 0; i < comments.length; i++) {
      const comment = comments[i].value;
      if (/^\s*@refresh granular\s*$/.test(comment)) {
        state.granular = true;
        break;
      }
      if (/^\s*@refresh skip\s*$/.test(comment)) {
        state.processed = true;
        shouldSkip = true;
        break;
      }
      if (/^\s*@refresh reload\s*$/.test(comment)) {
        state.processed = true;
        path.pushContainer('body', getHMRDeclineCall(state, path));
        break;
      }
    }
  }

  captureIdentifiers(state, path);
  if (!shouldSkip && (state.opts.fixRender ?? true)) {
    fixRenderCalls(state, path);
  }
}

function transformExportNamedDeclaration(
  state: State,
  path: babel.NodePath<t.ExportNamedDeclaration>,
): void {
  if (state.processed) {
    return;
  }
  const decl = path.node.declaration;
  // Check if declaration is FunctionDeclaration
  if (
    t.isFunctionDeclaration(decl) &&
    !(decl.generator || decl.async) &&
    // Might be component-like, but the only valid components
    // have zero or one parameter
    decl.params.length < 2
  ) {
    // Check if the declaration has an identifier, and then check
    // if the name is component-ish
    if (decl.id && isComponentishName(decl.id.name)) {
      path.node.declaration = t.variableDeclaration('const', [
        t.variableDeclarator(
          decl.id,
          wrapComponent(
            state,
            path,
            decl.id,
            t.functionExpression(decl.id, decl.params, decl.body),
            decl,
          ),
        ),
      ]);
    }
  }
}

function isStatementTopLevel(path: babel.NodePath<t.Statement>): boolean {
  const programParent = path.scope.getProgramParent();
  const blockParent = path.scope.getBlockParent();

  return programParent === blockParent;
}

function transformVariableDeclarator(
  state: State,
  path: babel.NodePath<t.VariableDeclarator>,
): void {
  if (state.processed) {
    return;
  }
  if (
    path.parentPath.isVariableDeclaration() &&
    !isStatementTopLevel(path.parentPath)
  ) {
    return;
  }
  const identifier = path.node.id;
  const init = path.node.init;
  if (!(init && t.isIdentifier(identifier))) {
    return;
  }
  if (isComponentishName(identifier.name)) {
    const trueFuncExpr =
      unwrapExpression(init, t.isFunctionExpression) ||
      unwrapExpression(init, t.isArrowFunctionExpression);
    // Check for valid FunctionExpression or ArrowFunctionExpression
    if (
      trueFuncExpr &&
      // Must not be async or generator
      !(trueFuncExpr.async || trueFuncExpr.generator) &&
      // Might be component-like, but the only valid components
      // have zero or one parameter
      trueFuncExpr.params.length < 2
    ) {
      path.node.init = wrapComponent(state, path, identifier, trueFuncExpr);
    }
  }
  // For `createContext` calls
  const trueCallExpr = unwrapExpression(init, t.isCallExpression);
  if (
    trueCallExpr &&
    isValidCallee(state, path, trueCallExpr, 'createContext')
  ) {
    path.node.init = wrapContext(state, path, identifier, trueCallExpr);
  }
}

export default function solidRefreshPlugin(): babel.PluginObj<State> {
  return {
    name: 'Solid Refresh',
    pre() {
      this.hooks = new Map();
      this.processed = false;
      this.granular = false;
      this.registrations = {
        identifiers: new Map(),
        namespaces: new Map(),
      };
      this.imports = [...IMPORT_IDENTITIES, ...(this.opts.imports || [])];
    },
    visitor: {
      Program(path, state) {
        setupProgram(state, path);
      },
      ExportNamedDeclaration(path, state) {
        transformExportNamedDeclaration(state, path);
      },
      ExportDefaultDeclaration(path, state) {
        
      },
      VariableDeclarator(path, state) {
        transformVariableDeclarator(state, path);
      },
      FunctionDeclaration(path, state) {
        if (state.processed) {
          return;
        }
        if (
          path.parentPath.isProgram() ||
          path.parentPath.isExportDefaultDeclaration()
        ) {
          const decl = path.node;
          // Check if declaration is FunctionDeclaration
          if (
            // Check if the declaration has an identifier, and then check
            decl.id &&
            // if the name is component-ish
            isComponentishName(decl.id.name) &&
            !(decl.generator || decl.async) &&
            // Might be component-like, but the only valid components
            // have zero or one parameter
            decl.params.length < 2
          ) {
            const replacement = wrapComponent(
              state,
              path,
              decl.id,
              t.functionExpression(decl.id, decl.params, decl.body),
              decl,
            );
            const newDecl = t.variableDeclaration('var', [
              t.variableDeclarator(decl.id, replacement),
            ]);
            if (path.parentPath.isExportDefaultDeclaration()) {
              path.parentPath.insertBefore(newDecl);
              path.replaceWith(decl.id);
            } else {
              path.replaceWith(newDecl);
            }
          }
        }
      },
    },
  };
}
