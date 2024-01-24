import * as t from '@babel/types';
import type * as babel from '@babel/core';

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

export function getForeignBindings(path: babel.NodePath): t.Identifier[] {
  const identifiers = new Set<string>();
  path.traverse({
    ReferencedIdentifier(p) {
      // Check identifiers that aren't in a TS expression
      if (!isInTypescript(p) && isForeignBinding(path, p, p.node.name)) {
        if (p.isIdentifier() || p.parentPath.isJSXMemberExpression()) {
          identifiers.add(p.node.name);
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
