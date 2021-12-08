import * as babel from '@babel/core';
import * as t from '@babel/types';
import generator from '@babel/generator';
import { addNamed } from '@babel/helper-module-imports';
import crypto from 'crypto';

type LocalMode = 'granular' | 'skip' | 'reload' | 'none';

type ImportHook = Map<string, t.Identifier>

interface Options {
  bundler?: 'esm' | 'standard' | 'vite';
}

interface Ref<T> {
  value: T;
}

interface State extends babel.PluginPass {
  hooks: ImportHook;
  opts: Options;
  processed: Ref<boolean>;
  granular: Ref<boolean>;
}

function isComponentishName(name: string) {
  return typeof name === 'string' && name[0] >= 'A' && name[0] <= 'Z';
}

function getSolidRefreshIdentifier(
  hooks: ImportHook,
  path: babel.NodePath,
  name: string,
): t.Identifier {
  const current = hooks.get(name);
  if (current) {
    return current;
  }
  const newID = addNamed(path, name, 'solid-refresh');
  hooks.set(name, newID);
  return newID;
}

function isESMHMR(bundler: Options['bundler']) {
  // The currently known ESM HMR implementations
  // esm - the original ESM HMR Spec
  // vite - Vite's implementation
  return bundler === 'esm' || bundler === 'vite';
}

function getHotIdentifier(bundler: Options['bundler']): t.MemberExpression {
  if (isESMHMR(bundler)) {
    return t.memberExpression(
      t.memberExpression(t.identifier('import'), t.identifier('meta')),
      t.identifier('hot'),
    );
  }
  return t.memberExpression(t.identifier("module"), t.identifier("hot"));
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

function createHotMap(
  hooks: ImportHook,
  path: babel.NodePath,
  name: string,
): t.Identifier {
  const current = hooks.get(name);
  if (current) {
    return current;
  }
  const newID = t.identifier(name);
  path.insertBefore(
    t.exportNamedDeclaration(
      t.variableDeclaration(
        'const',
        [t.variableDeclarator(
          newID,
          t.objectExpression([]),
        )],
      ),
    ),
  );
  hooks.set(name, newID);
  return newID;
}

function createSignatureValue(node: t.Node): string {
  const code = generator(node);
  const result = crypto.createHash('sha256').update(code.code).digest('base64');
  return result;
}

function isForeignBinding(
  source: babel.NodePath,
  current: babel.NodePath,
  name: string): boolean {
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

function createHotSignature(
  component: t.Identifier,
  sign?: t.Expression,
  deps?: t.Identifier[],
) {
  if (sign && deps) {
    return t.objectExpression([
      t.objectProperty(
        t.identifier('component'),
        component,
      ),
      t.objectProperty(
        t.identifier('id'),
        t.stringLiteral(component.name),
      ),
      t.objectProperty(
        t.identifier('signature'),
        sign,
      ),
      t.objectProperty(
        t.identifier('dependencies'),
        t.arrayExpression(deps),
      ),
    ]);
  }
  return t.objectExpression([
    t.objectProperty(
      t.identifier('component'),
      component,
    ),
    t.objectProperty(
      t.identifier('id'),
      t.stringLiteral(component.name),
    ),
  ]);
}

function getBindings(
  path: babel.NodePath,
): t.Identifier[] {
  const identifiers = new Set<string>();
  path.traverse({
    Expression(p) {
      if (
        t.isIdentifier(p.node)
        && !t.isTypeScript(p.parentPath.node)
        && isForeignBinding(path, p, p.node.name)
      ) {
        identifiers.add(p.node.name);
      }
      if (
        t.isJSXElement(p.node)
        && t.isJSXMemberExpression(p.node.openingElement.name)
      ) {
        let base: t.JSXMemberExpression | t.JSXIdentifier = p.node.openingElement.name;
        while (t.isJSXMemberExpression(base)) {
          base = base.object;
        }
        if (isForeignBinding(path, p, base.name)) {
          identifiers.add(base.name);
        }
      }
    }
  });
  return [...identifiers].map((value) => t.identifier(value));
}

function createStandardHot(
  path: babel.NodePath,
  state: State,
  mode: LocalMode,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration,
) {
  const HotImport = getSolidRefreshIdentifier(
    state.hooks,
    path,
    'standard',
  );
  const pathToHot = getHotIdentifier(state.opts.bundler);
  const statementPath = getStatementPath(path);
  if (statementPath) {
    statementPath.insertBefore(rename);
  }
  const isGranular = mode === 'reload' || mode === 'granular' || state.granular.value;
  return t.callExpression(HotImport, [
    createHotSignature(
      HotComponent,
      isGranular ? t.stringLiteral(createSignatureValue(rename)) : undefined,
      isGranular ? getBindings(path) : undefined,
    ),
    pathToHot,
    t.booleanLiteral(mode === 'reload'),
  ]);
}

function createESMHot(
  path: babel.NodePath,
  state: State,
  mode: LocalMode,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration,
) {
  const HotImport = getSolidRefreshIdentifier(
    state.hooks,
    path,
    'esm',
  );
  const pathToHot = getHotIdentifier(state.opts.bundler);
  const handlerId = path.scope.generateUidIdentifier("handler");
  const componentId = path.scope.generateUidIdentifier("Component");
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registrationMap = createHotMap(state.hooks, statementPath, '$$registrations');
    statementPath.insertBefore(rename);

    const isGranular = mode === 'reload' || mode === 'granular' || state.granular.value;
    statementPath.insertBefore(
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(
            registrationMap,
            HotComponent,
          ),
          createHotSignature(
            HotComponent,
            isGranular
              ? t.stringLiteral(createSignatureValue(rename))
              : undefined,
            isGranular
              ? getBindings(path)
              : undefined,
          ),
        ),
      )
    );
    statementPath.insertBefore(
      t.variableDeclaration("const", [
        t.variableDeclarator(
          t.objectPattern([
            t.objectProperty(t.identifier('handler'), handlerId, false, true),
            t.objectProperty(t.identifier('Component'), componentId, false, true)
          ]),
          t.callExpression(HotImport, [
            t.memberExpression(
              registrationMap,
              HotComponent,
            ),
            t.unaryExpression("!", t.unaryExpression("!", pathToHot)),
            t.booleanLiteral(mode === 'reload'),
          ]),
        )
      ])
    );
    const mod = path.scope.generateUidIdentifier('mod');
    statementPath.insertBefore(t.ifStatement(
      pathToHot,
      t.expressionStatement(
        t.callExpression(t.memberExpression(pathToHot, t.identifier("accept")), [
          t.arrowFunctionExpression(
            [mod],
            t.blockStatement([
              t.ifStatement(
                t.callExpression(handlerId, [
                  // Vite interprets this differently
                  state.opts.bundler === 'esm'
                    ? t.memberExpression(mod, t.identifier('module'))
                    : mod
                ]),
                t.expressionStatement(
                  t.callExpression(t.memberExpression(pathToHot, t.identifier("invalidate")), []),
                ),
              ),
            ]),
          )
        ]),
      ),
    ));
  }
  return componentId;
}

function createHot(
  path: babel.NodePath,
  state: State,
  mode: LocalMode,
  name: t.Identifier | undefined,
  expression: t.Expression,
) {
  const HotComponent = name
    ? path.scope.generateUidIdentifier(`Hot$$${name.name}`)
    : path.scope.generateUidIdentifier('HotComponent');
  const rename = t.variableDeclaration("const", [
    t.variableDeclarator(
      HotComponent,
      expression,
    ),
  ]);
  if (isESMHMR(state.opts.bundler)) {
    return createESMHot(path, state, mode, HotComponent, rename);
  }
  return createStandardHot(path, state, mode, HotComponent, rename);
}

function getLocalMode(node: t.Node): LocalMode {
  const comments = node.leadingComments;
  if (comments) {
    for (let i = 0, len = comments.length; i < len; i++) {
      const comment = comments[i].value;
      if (/^\s*@refresh local-skip\s*$/.test(comment)) {
        return 'skip';
      }
      if (/^\s*@refresh local-reload\s*$/.test(comment)) {
        return 'reload';
      }
      if (/^\s*@refresh local-granular\s*$/.test(comment)) {
        return 'granular';
      }
    }
  }
  return 'none';
}

export default function solidRefreshPlugin(): babel.PluginObj<State> {
  return {
    name: 'Solid Refresh',
    pre() {
      this.hooks = new Map();
      this.processed = {
        value: false,
      };
      this.granular = {
        value: false,
      };
    },
    visitor: {
      Program(path, { file, opts, processed, granular }) {
        const comments = file.ast.comments;
        if (comments) {
          for (let i = 0; i < comments.length; i++) {
            const comment = comments[i].value;
            if (/^\s*@refresh granular\s*$/.test(comment)) {
              granular.value = true;
              return;
            }
            if (/^\s*@refresh skip\s*$/.test(comment)) {
              processed.value = true;
              return;
            }
            if (/^\s*@refresh reload\s*$/.test(comment)) {
              processed.value = true;
              const pathToHot = getHotIdentifier(opts.bundler);
              path.pushContainer(
                'body',
                isESMHMR(opts.bundler)
                  ? (
                    t.ifStatement(
                      pathToHot,
                      t.expressionStatement(
                        t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
                      )
                    )
                  )
                  : (
                    t.ifStatement(
                      pathToHot,
                      t.expressionStatement(
                        t.conditionalExpression(
                          t.memberExpression(pathToHot, t.identifier("decline")),
                          t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), []),
                          t.callExpression(
                            t.memberExpression(
                              t.memberExpression(t.identifier("window"), t.identifier("location")),
                              t.identifier("reload"),
                            ),
                            [],
                          ),
                        )
                      )
                    )
                  )
              );
              return;
            }
          }
        }
      },
      ExportNamedDeclaration(path, state) {
        if (state.processed.value) {
          return;
        }
        const decl = path.node.declaration;
        // Check if declaration is FunctionDeclaration
        if (
          t.isFunctionDeclaration(decl)
          && !(decl.generator || decl.async)
          // Might be component-like, but the only valid components
          // have zero or one parameter
          && decl.params.length < 2
        ) {
          // Check if the declaration has an identifier, and then check 
          // if the name is component-ish
          if (decl.id && isComponentishName(decl.id.name)) {
            const mode = getLocalMode(decl);
            if (mode === 'skip') {
              return;
            }
            path.node.declaration = t.variableDeclaration(
              'const',
              [
                t.variableDeclarator(
                  decl.id,
                  createHot(
                    path,
                    state,
                    mode,
                    decl.id,
                    t.functionExpression(
                      decl.id,
                      decl.params,
                      decl.body,
                    )
                  ),
                )
              ],
            );
          }
        }
      },
      VariableDeclarator(path, state) {
        if (state.processed.value) {
          return;
        }
        const grandParentNode = path.parentPath?.parentPath?.node;
        // Check if the parent of the VariableDeclaration
        // is either a Program or an ExportNamedDeclaration
        if (
          t.isProgram(grandParentNode)
          || t.isExportNamedDeclaration(grandParentNode)
        ) {
          const identifier = path.node.id;
          const init = path.node.init;

          if (
            t.isIdentifier(identifier)
            && isComponentishName(identifier.name)
            && (
              // Check for valid FunctionExpression
              (t.isFunctionExpression(init) && !(init.async || init.generator))
              // Check for valid ArrowFunctionExpression
              || (t.isArrowFunctionExpression(init) && !(init.async || init.generator))
            )
            // Might be component-like, but the only valid components
            // have zero or one parameter
            && init.params.length < 2
          ) {
            const mode = getLocalMode(init);
            if (mode === 'skip') {
              return;
            }
            path.node.init = createHot(
              path,
              state,
              mode,
              identifier,
              init,
            );
          }
        }
      },
      FunctionDeclaration(path, state) {
        if (state.processed.value) {
          return;
        }
        if (!(
          t.isProgram(path.parentPath.node)
          || t.isExportDefaultDeclaration(path.parentPath.node)
        )) {
          return;
        }
        const decl = path.node;
        // Check if declaration is FunctionDeclaration
        if (
          !(decl.generator || decl.async)
          // Might be component-like, but the only valid components
          // have zero or one parameter
          && decl.params.length < 2
        ) {
          // Check if the declaration has an identifier, and then check 
          // if the name is component-ish
          if (decl.id && isComponentishName(decl.id.name)) {
            const mode = getLocalMode(decl);
            if (mode === 'skip') {
              return;
            }
            const replacement = createHot(
              path,
              state,
              mode,
              decl.id,
              t.functionExpression(
                decl.id,
                decl.params,
                decl.body,
              )
            );
            if (t.isExportDefaultDeclaration(path.parentPath.node)) {
              path.replaceWith(replacement);
            } else {
              path.replaceWith(t.variableDeclaration(
                'var',
                [
                  t.variableDeclarator(
                    decl.id,
                    replacement,
                  ),
                ]
              ));
            }
          } else if (
            !decl.id
            && decl.params.length === 1
            && t.isIdentifier(decl.params[0])
            && decl.params[0].name === 'props'
            && t.isExportDefaultDeclaration(path.parentPath.node)
          ) {
            const mode = getLocalMode(decl);
            if (mode === 'skip') {
              return;
            }
            const replacement = createHot(
              path,
              state,
              mode,
              undefined,
              t.functionExpression(
                null,
                decl.params,
                decl.body,
              )
            );
            path.replaceWith(replacement);
          }
        }
      }
    },
  }
}