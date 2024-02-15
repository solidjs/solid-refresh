import type * as babel from '@babel/core';
import * as t from '@babel/types';
import path from 'path';
import { isComponentishName } from './core/checks';
import {
  IMPORT_COMPONENT,
  IMPORT_CONTEXT,
  IMPORT_SPECIFIERS,
} from './core/constants';
import { createRegistry } from './core/create-registry';
import { generateCode } from './core/generator';
import { getForeignBindings } from './core/get-foreign-bindings';
import { getHMRDeclineCall } from './core/get-hmr-decline-call';
import { getHotIdentifier } from './core/get-hot-identifier';
import { getImportIdentifier } from './core/get-import-identifier';
import { getStatementPath } from './core/get-statement-path';
import { isStatementTopLevel } from './core/is-statement-top-level';
import { isValidCallee } from './core/is-valid-callee';
import { registerImportSpecifiers } from './core/register-import-specifiers';
import { transformJSX } from './core/transform-jsx';
import type { Options, StateContext } from './core/types';
import { unwrapNode } from './core/unwrap';
import { xxHash32 } from './core/xxhash32';

const CWD = process.cwd();

function getFile(filename: string) {
  return path.relative(CWD, filename);
}

function createSignatureValue(node: t.Node): string {
  const code = generateCode(node);
  const result = xxHash32(code).toString(16);
  return result;
}

function captureIdentifiers(state: StateContext, path: babel.NodePath) {
  path.traverse({
    ImportDeclaration(p) {
      if (!(p.node.importKind === 'type' || p.node.importKind === 'typeof')) {
        registerImportSpecifiers(state, p, state.specifiers);
      }
    },
  });
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

function fixRenderCalls(state: StateContext, path: babel.NodePath<t.Program>) {
  path.traverse({
    ExpressionStatement(p) {
      const trueCallExpr = unwrapNode(p.node.expression, t.isCallExpression);
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
  state: StateContext,
  path: babel.NodePath,
  identifier: t.Identifier,
  component: t.FunctionExpression | t.ArrowFunctionExpression,
  original: t.Node = component,
) {
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registry = createRegistry(state, statementPath);
    const hotName = t.stringLiteral(identifier.name);
    const componentCall = getImportIdentifier(
      state,
      statementPath,
      IMPORT_COMPONENT,
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
      const dependencies = getForeignBindings(path);
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
            t.arrowFunctionExpression([], t.objectExpression(dependencyKeys)),
          ),
        );
      }
    }
    return t.callExpression(componentCall, [
      registry,
      hotName,
      component,
      t.objectExpression(properties),
    ]);
  }
  return component;
}

function wrapContext(
  state: StateContext,
  path: babel.NodePath,
  identifier: t.Identifier,
  context: t.CallExpression,
) {
  const statementPath = getStatementPath(path);
  if (statementPath) {
    const registry = createRegistry(state, statementPath);
    const hotName = t.stringLiteral(identifier.name);
    const contextCall = getImportIdentifier(
      state,
      statementPath,
      IMPORT_CONTEXT,
    );

    return t.callExpression(contextCall, [registry, hotName, context]);
  }
  return context;
}

function setupProgram(
  state: StateContext,
  path: babel.NodePath<t.Program>,
  comments: t.Comment[] | undefined | null,
): boolean {
  let shouldSkip = false;
  let isDone = false;
  if (comments) {
    for (const { value: comment } of comments) {
      if (/^\s*@refresh skip\s*$/.test(comment)) {
        isDone = true;
        shouldSkip = true;
        break;
      }
      if (/^\s*@refresh reload\s*$/.test(comment)) {
        isDone = true;
        path.pushContainer('body', getHMRDeclineCall(state, path));
        break;
      }
    }
  }

  if (!shouldSkip && state.fixRender) {
    captureIdentifiers(state, path);
    fixRenderCalls(state, path);
  }
  return isDone;
}

function isValidFunction(
  node: t.Node,
): node is t.ArrowFunctionExpression | t.FunctionExpression {
  return t.isArrowFunctionExpression(node) || t.isFunctionExpression(node);
}

function transformVariableDeclarator(
  state: StateContext,
  path: babel.NodePath<t.VariableDeclarator>,
): void {
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
    const trueFuncExpr = unwrapNode(init, isValidFunction);
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
  const trueCallExpr = unwrapNode(init, t.isCallExpression);
  if (
    trueCallExpr &&
    isValidCallee(state, path, trueCallExpr, 'createContext')
  ) {
    path.node.init = wrapContext(state, path, identifier, trueCallExpr);
  }
  path.skip();
}

function transformFunctionDeclaration(
  state: StateContext,
  path: babel.NodePath<t.FunctionDeclaration>,
): void {
  if (isStatementTopLevel(path)) {
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
      const [tmp] = path.replaceWith(
        t.variableDeclaration('const', [
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
        ]),
      );
      path.scope.registerDeclaration(tmp);
      path.skip();
    }
  }
}

function bubbleFunctionDeclaration(
  program: babel.NodePath<t.Program>,
  path: babel.NodePath<t.FunctionDeclaration>,
): void {
  if (isStatementTopLevel(path)) {
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
      const first = program.get('body')[0];
      const [tmp] = first.insertBefore(decl);
      program.scope.registerDeclaration(tmp);
      tmp.skip();
      if (path.parentPath.isExportNamedDeclaration()) {
        path.parentPath.replaceWith(
          t.exportNamedDeclaration(undefined, [
            t.exportSpecifier(decl.id, decl.id),
          ]),
        );
      } else if (path.parentPath.isExportDefaultDeclaration()) {
        path.replaceWith(decl.id);
      } else {
        path.remove();
      }
    }
  }
}

interface State extends babel.PluginPass {
  opts: Options;
}

export type { Options };

export default function solidRefreshPlugin(): babel.PluginObj<State> {
  return {
    name: 'solid-refresh',
    visitor: {
      Program(programPath, context) {
        const state: StateContext = {
          jsx: context.opts.jsx ?? true,
          granular: context.opts.granular ?? true,
          opts: context.opts,
          specifiers: [...IMPORT_SPECIFIERS],
          imports: new Map(),
          registrations: {
            identifiers: new Map(),
            namespaces: new Map(),
          },
          filename: context.filename,
          bundler: context.opts.bundler || 'standard',
          fixRender: context.opts.fixRender ?? true,
        };
        if (setupProgram(state, programPath, context.file.ast.comments)) {
          return;
        }
        programPath.traverse({
          FunctionDeclaration(path) {
            bubbleFunctionDeclaration(programPath, path);
          },
        });
        if (state.jsx) {
          programPath.traverse({
            JSXElement(path) {
              transformJSX(path);
            },
            JSXFragment(path) {
              transformJSX(path);
            },
          });
        }
        programPath.traverse({
          VariableDeclarator(path) {
            transformVariableDeclarator(state, path);
          },
          FunctionDeclaration(path) {
            transformFunctionDeclaration(state, path);
          },
        });
      },
    },
  };
}
