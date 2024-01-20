import * as t from '@babel/types';
import type * as babel from '@babel/core';
import { getDescriptiveName } from './get-descriptive-name';
import { isPathValid, unwrapNode } from './unwrap';
import { generateUniqueName } from './generate-unique-name';
import { getRootStatementPath } from './get-root-statement-path';

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
    extractJSXExpressions(state, value);
  }
  if (isPathValid(value, t.isJSXExpressionContainer)) {
    const expr = value.get('expression');
    if (
      isPathValid(expr, t.isJSXElement) ||
      isPathValid(expr, t.isJSXFragment)
    ) {
      extractJSXExpressions(state, expr);
    } else if (isPathValid(expr, t.isExpression)) {
      const key = 'v' + state.attributes.length;
      state.attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier(key),
          t.jsxExpressionContainer(expr.node),
        ),
      );
      expr.replaceWith(t.memberExpression(state.props, t.identifier(key)));
    }
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
              t.blockStatement([
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
      const key = 'v' + state.attributes.length;
      state.attributes.push(
        t.jsxAttribute(
          t.jsxIdentifier(key),
          t.jsxExpressionContainer(replacement),
        ),
      );
      expr.replaceWith(t.memberExpression(state.props, t.identifier(key)));
    }
  }
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
    extractJSXExpressionFromNormalAttribute(state, attr);
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
      if (
        isPathValid(arg, t.isJSXElement) ||
        isPathValid(arg, t.isJSXFragment)
      ) {
        extractJSXExpressions(state, arg);
      } else {
        const key = 'v' + state.attributes.length;
        state.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier(key),
            t.jsxExpressionContainer(arg.node),
          ),
        );
        arg.replaceWith(t.memberExpression(state.props, t.identifier(key)));
      }
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
    const key = 'v' + state.attributes.length;
    state.attributes.push(
      t.jsxAttribute(
        t.jsxIdentifier(key),
        t.jsxExpressionContainer(
          convertJSXOpeningToExpression(openingName.node),
        ),
      ),
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
  extractJSXExpressionsFromAttributes(state, path);
}

function extractJSXExpressionsFromJSXExpressionContainer(
  state: JSXState,
  child: babel.NodePath<t.JSXExpressionContainer>,
): void {
  const expr = child.get('expression');
  if (isPathValid(expr, t.isJSXElement) || isPathValid(expr, t.isJSXFragment)) {
    extractJSXExpressions(state, expr);
  } else if (isPathValid(expr, t.isExpression)) {
    const key = 'v' + state.attributes.length;
    state.attributes.push(
      t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(expr.node)),
    );
    expr.replaceWith(t.memberExpression(state.props, t.identifier(key)));
  }
}

function extractJSXExpressionsFromJSXSpreadChild(
  state: JSXState,
  child: babel.NodePath<t.JSXSpreadChild>,
): void {
  const arg = child.get('expression');
  if (isPathValid(arg, t.isJSXElement) || isPathValid(arg, t.isJSXFragment)) {
    extractJSXExpressions(state, arg);
  } else {
    const key = 'v' + state.attributes.length;
    state.attributes.push(
      t.jsxAttribute(t.jsxIdentifier(key), t.jsxExpressionContainer(arg.node)),
    );
    arg.replaceWith(t.memberExpression(state.props, t.identifier(key)));
  }
}

function extractJSXExpressions(
  state: JSXState,
  path: babel.NodePath<t.JSXElement | t.JSXFragment>,
): void {
  if (isPathValid(path, t.isJSXElement)) {
    extractJSXExpressionsFromJSXElement(state, path);
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
  };

  extractJSXExpressions(state, path);

  const id = generateUniqueName(
    path,
    'JSX_' + getDescriptiveName(path, 'template'),
  );

  const rootPath = getRootStatementPath(path);

  rootPath.insertBefore(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        id,
        t.arrowFunctionExpression(
          [state.props],
          skippableJSX(t.cloneNode(path.node)),
        ),
      ),
    ]),
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
