import * as babel from '@babel/core';
import * as t from '@babel/types';
import generator from '@babel/generator';
import { addNamed } from '@babel/helper-module-imports';
import crypto from 'crypto';

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

function getHotIdentifier(bundler: Options['bundler']): t.MemberExpression {
  if (bundler === 'esm') {
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

function createHotSignature(
  id: t.StringLiteral,
  sign?: t.Expression,
  deps?: t.Identifier[],
) {
  if (sign && deps) {
    return t.objectExpression([
      t.objectProperty(
        t.identifier('id'),
        id,
      ),
      t.objectProperty(
        t.identifier('value'),
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
      t.identifier('id'),
      id,
    ),
  ]);
}


function createRegistration(
  id: t.Identifier,
  sign?: t.StringLiteral,
  deps?: t.Identifier[],
) {
  if (sign && deps) {
    return t.objectExpression([
      t.objectProperty(
        t.identifier('component'),
        id,
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
      id,
    ),
  ]);
}

function createStandardHot(
  path: babel.NodePath,
  state: State,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration,
) {
  const HotImport = getSolidRefreshIdentifier(
    state.hooks,
    path,
    state.opts.bundler || 'standard',
  );
  const pathToHot = getHotIdentifier(state.opts.bundler);
  const statementPath = getStatementPath(path);
  if (statementPath) {
    statementPath.insertBefore(rename);
  }
  return t.callExpression(HotImport, [
    HotComponent,
    createHotSignature(
      t.stringLiteral(HotComponent.name),
      state.granular.value ? t.stringLiteral(createSignatureValue(rename)) : undefined,
      state.granular.value ? [] : undefined,
    ),
    pathToHot,
  ]);
}

function createESMHot(
  path: babel.NodePath,
  state: State,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration,
) {
  const HotImport = getSolidRefreshIdentifier(
    state.hooks,
    path,
    state.opts.bundler || 'standard',
  );
  const pathToHot = getHotIdentifier(state.opts.bundler);
  const handlerId = path.scope.generateUidIdentifier("handler");
  const componentId = path.scope.generateUidIdentifier("Component");
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registrationMap = createHotMap(state.hooks, statementPath, '$$registrations');
    statementPath.insertBefore(rename);
    statementPath.insertBefore(
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(
            registrationMap,
            HotComponent,
          ),
          createRegistration(
            HotComponent,
            state.granular.value ? t.stringLiteral(createSignatureValue(rename)) : undefined,
            state.granular.value ? [] : undefined,
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
            HotComponent,
            createHotSignature(
              t.stringLiteral(HotComponent.name),
              t.memberExpression(
                t.memberExpression(
                  registrationMap,
                  HotComponent,
                ),
                t.identifier('signature'),
              ),
              state.granular.value ? [] : undefined,
            ),
            t.unaryExpression("!", t.unaryExpression("!", pathToHot))
          ]),
        )
      ])
    );
    statementPath.insertBefore(t.ifStatement(
      pathToHot,
      t.expressionStatement(
        t.callExpression(t.memberExpression(pathToHot, t.identifier("accept")), [handlerId])
      )
    ));
  }
  return componentId;
}

function createHot(
  path: babel.NodePath,
  state: State,
  name: t.Identifier | undefined,
  expression: t.Expression,
) {
  if (state.opts.bundler === "vite") state.opts.bundler = "esm";
  const HotComponent = name
    ? path.scope.generateUidIdentifier(`Hot$$${name.name}`)
    : path.scope.generateUidIdentifier('HotComponent');
  const rename = t.variableDeclaration("const", [
    t.variableDeclarator(
      HotComponent,
      expression,
    ),
  ]);
  if (state.opts.bundler === "esm") {
    return createESMHot(path, state, HotComponent, rename);
  }
  return createStandardHot(path, state, HotComponent, rename);
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
      Program(path, { opts, processed, granular }) {
        const comments = path.hub.file.ast.comments;
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
            if (opts.bundler === "vite") opts.bundler = "esm";
            processed.value = true;
            const pathToHot = getHotIdentifier(opts.bundler);
            path.pushContainer(
              "body",
              t.ifStatement(
                pathToHot,
                t.expressionStatement(
                  t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
                )
              )
            );
            return;
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
            path.node.declaration = t.variableDeclaration(
              'const',
              [
                t.variableDeclarator(
                  decl.id,
                  createHot(
                    path,
                    state,
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
            path.node.init = createHot(
              path,
              state,
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
            const replacement = createHot(
              path,
              state,
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
            const replacement = createHot(
              path,
              state,
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