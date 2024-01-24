import type * as babel from '@babel/core';
import * as t from '@babel/types';

export function getStatementPath(path: babel.NodePath): babel.NodePath | null {
  if (t.isStatement(path.node)) {
    return path;
  }
  if (path.parentPath) {
    return getStatementPath(path.parentPath);
  }
  return null;
}
