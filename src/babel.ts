import * as babel from '@babel/core';
import * as t from '@babel/types';
import { addNamed } from '@babel/helper-module-imports';

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
        if (!t.isProgram(path.parentPath.node)) {
          return;
        }
        const decl = path.node;
        // Check if declaration is FunctionDeclaration
        if (!(decl.generator || decl.async)) {
          // Check if the declaration has an identifier, and then check 
          // if the name is component-ish
          if (decl.id && isComponentishName(decl.id.name)) {
            path.replaceWith(
              t.variableDeclaration(
                'var',
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
                  ),
                ]
              ),
            );
          }

          // TODO Check for props identifier
        }
      }
    },
  }
}