import * as babel from '@babel/core';
import * as t from '@babel/types';
import generator from '@babel/generator';
import { addNamed } from '@babel/helper-module-imports';
import crypto from 'crypto';

type ImportHook = Map<string, t.Identifier>

interface Options {
  bundler?: 'esm' | 'standard' | 'vite';
}

interface State extends babel.PluginPass {
  hooks: ImportHook;
  opts: Options;
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

function createStandardHot(
  path: babel.NodePath,
  hooks: ImportHook,
  opts: Options,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration,
) {
  const HotImport = getSolidRefreshIdentifier(hooks, path, opts.bundler || 'standard');
  const pathToHot = getHotIdentifier(opts.bundler);
  const statementPath = getStatementPath(path);
  if (statementPath) {
    statementPath.insertBefore(rename);
  }
  return t.callExpression(HotImport, [
    HotComponent,
    t.stringLiteral(HotComponent.name),
    pathToHot,
  ]);
}

function createESMHot(
  path: babel.NodePath,
  hooks: ImportHook,
  opts: Options,
  HotComponent: t.Identifier,
  rename: t.VariableDeclaration,
) {
  const HotImport = getSolidRefreshIdentifier(hooks, path, opts.bundler || 'standard');
  const pathToHot = getHotIdentifier(opts.bundler);
  const handlerId = path.scope.generateUidIdentifier("handler");
  const componentId = path.scope.generateUidIdentifier("Component");
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registrationMap = createHotMap(hooks, statementPath, '$$registrations');
    const signaturesMap = createHotMap(hooks, statementPath, '$$signatures');
    statementPath.insertBefore(rename);
    statementPath.insertBefore(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          registrationMap,
          HotComponent,
        ),
        HotComponent,
      ),
    );
    const code = generator(rename);
    const result = crypto.createHash('sha256').update(code.code).digest('hex');

    statementPath.insertBefore(
      t.assignmentExpression(
        '=',
        t.memberExpression(
          signaturesMap,
          HotComponent,
        ),
        t.stringLiteral(result),
      ),
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
            t.stringLiteral(HotComponent.name),
            t.unaryExpression("!", t.unaryExpression("!", pathToHot))
          ])
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
  hooks: ImportHook,
  opts: Options,
  expression: t.Expression,
) {
  if (opts.bundler === "vite") opts.bundler = "esm";
  const HotComponent = path.scope.generateUidIdentifier('HotComponent');
  const rename = t.variableDeclaration("const", [
    t.variableDeclarator(
      HotComponent,
      expression,
    ),
  ]);
  if (opts.bundler === "esm") {
    return createESMHot(path, hooks, opts, HotComponent, rename);
  }
  return createStandardHot(path, hooks, opts, HotComponent, rename);
}

export default function solidRefreshPlugin(): babel.PluginObj<State> {
  return {
    name: 'Solid Refresh',
    pre() {
      this.hooks = new Map();
    },
    visitor: {
      Program(path, { opts }) {
        // const comments = path.hub.file.ast.comments;
        // for (let i = 0; i < comments.length; i++) {
        //   const comment = comments[i];
        //   const index = comment.value.indexOf("@refresh");
        //   if (index > -1) {
        //     if (comment.value.slice(index).includes("skip")) {
        //       path.hub.file.metadata.processedHot = true;
        //       return;
        //     }
        //     if (comment.value.slice(index).includes("reload")) {
        //       if (opts.bundler === "vite") opts.bundler = "esm";
        //       path.hub.file.metadata.processedHot = true;
        //       const pathToHot = getHotIdentifier(opts.bundler);
        //       path.pushContainer(
        //         "body",
        //         t.ifStatement(
        //           pathToHot,
        //           t.expressionStatement(
        //             t.callExpression(t.memberExpression(pathToHot, t.identifier("decline")), [])
        //           )
        //         )
        //       );
        //       return;
        //     }
        //   }
        // }
      },
      ExportNamedDeclaration(path, { opts, hooks }) {
        const decl = path.node.declaration;
        // Check if declaration is FunctionDeclaration
        if (t.isFunctionDeclaration(decl) && !(decl.generator || decl.async)) {
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
                    hooks,
                    opts,
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
      VariableDeclarator(path, { opts, hooks }) {
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
          ) {
            path.node.init = createHot(
              path,
              hooks,
              opts,
              init,
            );
          }
        }
      },
      FunctionDeclaration(path, { opts, hooks }) {
        // if (path.hub.file.metadata.processedHot) return;
        if (!(
          t.isProgram(path.parentPath.node)
          || t.isExportDefaultDeclaration(path.parentPath.node)
        )) {
          return;
        }
        const decl = path.node;
        // Check if declaration is FunctionDeclaration
        if (!(decl.generator || decl.async)) {
          // Check if the declaration has an identifier, and then check 
          // if the name is component-ish
          if (decl.id && isComponentishName(decl.id.name)) {
            const replacement = createHot(
              path,
              hooks,
              opts,
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
              hooks,
              opts,
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