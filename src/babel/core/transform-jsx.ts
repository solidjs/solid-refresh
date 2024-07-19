import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { isComponentishName } from './checks';
import { generateUniqueName } from './generate-unique-name';
import { getDescriptiveName } from './get-descriptive-name';
import { getRootStatementPath } from './get-root-statement-path';
import { isStatementTopLevel } from './is-statement-top-level';
import { isPathValid, unwrapNode } from './unwrap';

const REFRESH_JSX_SKIP = /^\s*@refresh jsx-skip\s*$/;

function shouldSkipJSX(node: t.Node): boolean {
  // Node without leading comments shouldn't be skipped
  if (node.leadingComments) {
    for (let i = 0, len = node.leadingComments.length; i < len; i++) {
      if (REFRESH_JSX_SKIP.test(node.leadingComments[i].value)) {
        return true;
      }
    }
  }
  return false;
}

function skippableJSX<T extends t.Node>(node: T): T {
  return t.addComment(node, 'leading', '@refresh jsx-skip');
}

interface JSXState {
  props: t.Identifier;
  attributes: t.JSXAttribute[];
  vars: t.VariableDeclarator[];
}

function pushAttribute(state: JSXState, replacement: t.Expression): string {
  const key = 'v' + state.attributes.length;
  state.attributes.push(
    t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(replacement)),
  );
  return key;
}

function pushAttributeAndReplace(
  state: JSXState,
  target: babel.NodePath<t.Expression>,
  replacement: t.Expression,
) {
  const key = pushAttribute(state, replacement);
  target.replaceWith(t.memberExpression(state.props, t.identifier(key)));
}

function extractJSXExpressionFromNormalAttribute(
  state: JSXState,
  attr: babel.NodePath<t.JSXAttribute>,
): void {
  const value = attr.get('value');
  if (
    isPathValid(value, t.isJSXElement) ||
    isPathValid(value, t.isJSXFragment)
  ) {
    value.replaceWith(t.jsxExpressionContainer(value.node));
  }
  if (isPathValid(value, t.isJSXExpressionContainer)) {
    extractJSXExpressionsFromJSXExpressionContainer(state, value);
  }
}

function extractJSXExpressionFromRef(
  state: JSXState,
  attr: babel.NodePath<t.JSXAttribute>,
): void {
  const value = attr.get('value');

  if (isPathValid(value, t.isJSXExpressionContainer)) {
    const expr = value.get('expression');
    if (isPathValid(expr, t.isExpression)) {
      const unwrappedIdentifier = unwrapNode(expr.node, t.isIdentifier);
      let replacement: t.Expression;
      if (unwrappedIdentifier) {
        const arg = expr.scope.generateUidIdentifier('arg');
        const binding = expr.scope.getBinding(unwrappedIdentifier.name);
        const cannotAssignKind = ['const', 'module'];
        const isConst = binding && cannotAssignKind.includes(binding.kind);

        replacement = t.arrowFunctionExpression(
          [arg],
          t.blockStatement([
            t.ifStatement(
              t.binaryExpression(
                '===',
                t.unaryExpression('typeof', unwrappedIdentifier),
                t.stringLiteral('function'),
              ),
              t.blockStatement([
                t.expressionStatement(
                  t.callExpression(unwrappedIdentifier, [arg]),
                ),
              ]),
              // fix the new usage of `ref` attribute,
              // if use `Signals as refs`, the `else` branch will throw an errow with `Cannot assign to "setter" because it is a constant` message
              // issue: https://github.com/solidjs/solid-refresh/issues/66
              // docs: https://docs.solidjs.com/concepts/refs#signals-as-refs
              isConst
                ? null
                : t.blockStatement([
                    t.expressionStatement(
                      t.assignmentExpression('=', unwrappedIdentifier, arg),
                    ),
                  ]),
            ),
          ]),
        );
      } else {
        replacement = expr.node;
      }
      pushAttributeAndReplace(state, expr, replacement);
    }
  }
}

function extractJSXExpressionFromUseDirective(
  state: JSXState,
  id: t.JSXIdentifier,
  attr: babel.NodePath<t.JSXAttribute>,
): void {
  const value = attr.get('value');

  if (isPathValid(value, t.isJSXExpressionContainer)) {
    extractJSXExpressionsFromJSXExpressionContainer(state, value);
  }

  const key = pushAttribute(state, t.identifier(id.name));
  state.vars.push(
    t.variableDeclarator(
      t.identifier(id.name),
      t.memberExpression(state.props, t.identifier(key)),
    ),
  );
}

function extractJSXExpressionFromAttribute(
  state: JSXState,
  attr: babel.NodePath<t.JSXAttribute>,
): void {
  const key = attr.get('name');
  if (isPathValid(key, t.isJSXIdentifier)) {
    if (key.node.name === 'ref') {
      extractJSXExpressionFromRef(state, attr);
    } else {
      extractJSXExpressionFromNormalAttribute(state, attr);
    }
  } else if (isPathValid(key, t.isJSXNamespacedName)) {
    if (key.node.namespace.name === 'use') {
      extractJSXExpressionFromUseDirective(state, key.node.name, attr);
    } else {
      extractJSXExpressionFromNormalAttribute(state, attr);
    }
  }
}

function extractJSXExpressionsFromAttributes(
  state: JSXState,
  path: babel.NodePath<t.JSXElement>,
): void {
  const openingElement = path.get('openingElement');
  const attrs = openingElement.get('attributes');
  for (let i = 0, len = attrs.length; i < len; i++) {
    const attr = attrs[i];

    if (isPathValid(attr, t.isJSXAttribute)) {
      extractJSXExpressionFromAttribute(state, attr);
    }
    if (isPathValid(attr, t.isJSXSpreadAttribute)) {
      const arg = attr.get('argument');
      pushAttributeAndReplace(state, arg, arg.node);
    }
  }
}

function convertJSXOpeningToExpression(
  node: t.JSXIdentifier | t.JSXMemberExpression,
): t.Identifier | t.MemberExpression | t.NullLiteral {
  if (t.isJSXIdentifier(node)) {
    return t.identifier(node.name);
  }
  return t.memberExpression(
    convertJSXOpeningToExpression(node.object),
    convertJSXOpeningToExpression(node.property),
  );
}

function extractJSXExpressionsFromJSXElement(
  state: JSXState,
  path: babel.NodePath<t.JSXElement>,
): void {
  const openingElement = path.get('openingElement');
  const openingName = openingElement.get('name');
  if (
    (isPathValid(openingName, t.isJSXIdentifier) &&
      /^[A-Z_]/.test(openingName.node.name)) ||
    isPathValid(openingName, t.isJSXMemberExpression)
  ) {
    if (isPathValid(openingName, t.isJSXIdentifier)) {
      const binding = path.scope.getBinding(openingName.node.name);
      if (binding) {
        const statementPath = binding.path.getStatementParent();
        if (statementPath && isStatementTopLevel(statementPath)) {
          return;
        }
      }
    }
    const key = pushAttribute(
      state,
      convertJSXOpeningToExpression(openingName.node),
    );
    const replacement = t.jsxMemberExpression(
      t.jsxIdentifier(state.props.name),
      t.jsxIdentifier(key),
    );
    openingName.replaceWith(replacement);

    const closingElement = path.get('closingElement');
    if (isPathValid(closingElement, t.isJSXClosingElement)) {
      closingElement.get('name').replaceWith(replacement);
    }
  }
}

function extractJSXExpressionsFromJSXExpressionContainer(
  state: JSXState,
  child: babel.NodePath<t.JSXExpressionContainer>,
): void {
  const expr = child.get('expression');
  if (isPathValid(expr, t.isExpression)) {
    pushAttributeAndReplace(state, expr, expr.node);
  }
}

function extractJSXExpressionsFromJSXSpreadChild(
  state: JSXState,
  child: babel.NodePath<t.JSXSpreadChild>,
): void {
  const arg = child.get('expression');
  pushAttributeAndReplace(state, arg, arg.node);
}

function extractJSXExpressions(
  state: JSXState,
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
): void {
  if (isPathValid(path, t.isJSXElement)) {
    extractJSXExpressionsFromJSXElement(state, path);
    extractJSXExpressionsFromAttributes(state, path);
  }
  const children = path.get('children');
  for (let i = 0, len = children.length; i < len; i++) {
    const child = children[i];

    if (
      isPathValid(child, t.isJSXElement) ||
      isPathValid(child, t.isJSXFragment)
    ) {
      extractJSXExpressions(state, child);
    } else if (isPathValid(child, t.isJSXExpressionContainer)) {
      extractJSXExpressionsFromJSXExpressionContainer(state, child);
    } else if (isPathValid(child, t.isJSXSpreadChild)) {
      extractJSXExpressionsFromJSXSpreadChild(state, child);
    }
  }
}

export function transformJSX(
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
): void {
  if (shouldSkipJSX(path.node)) {
    return;
  }

  const state: JSXState = {
    props: path.scope.generateUidIdentifier('props'),
    attributes: [],
    vars: [],
  };

  extractJSXExpressions(state, path);

  const descriptiveName = getDescriptiveName(path, 'template');
  const id = generateUniqueName(
    path,
    isComponentishName(descriptiveName)
      ? descriptiveName
      : 'JSX_' + descriptiveName,
  );

  const rootPath = getRootStatementPath(path);

  let template: t.Expression | t.BlockStatement = skippableJSX(
    t.cloneNode(path.node),
  );

  if (state.vars.length) {
    template = t.blockStatement([
      t.variableDeclaration('const', state.vars),
      t.returnStatement(template),
    ]);
  }

  const templateComp = t.arrowFunctionExpression([state.props], template);

  if (path.node.loc) {
    templateComp.loc = path.node.loc;
  }

  rootPath.scope.registerDeclaration(
    rootPath.insertBefore(
      t.variableDeclaration('const', [t.variableDeclarator(id, templateComp)]),
    )[0],
  );

  path.replaceWith(
    skippableJSX(
      t.jsxElement(
        t.jsxOpeningElement(
          t.jsxIdentifier(id.name),
          [...state.attributes],
          true,
        ),
        t.jsxClosingElement(t.jsxIdentifier(id.name)),
        [],
        true,
      ),
    ),
  );
}
