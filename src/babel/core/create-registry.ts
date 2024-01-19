import type { StateContext } from './types';
import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { getImportIdentifier } from './get-import-identifier';
import { IMPORT_REFRESH, IMPORT_REGISTRY } from './constants';
import { getHotIdentifier } from './get-hot-identifier';
import { generateViteHMRRequirement } from './get-vite-hmr-requirement';
import { getRootStatementPath } from './get-root-statement-path';

const REGISTRY = 'REGISTRY';

export function createRegistry(
  state: StateContext,
  path: babel.NodePath,
): t.Identifier {
  const current = state.imports.get(REGISTRY);
  if (current) {
    return current;
  }
  const root = getRootStatementPath(path);
  const identifier = path.scope.generateUidIdentifier(REGISTRY);

  root.insertBefore(
    t.variableDeclaration('const', [
      t.variableDeclarator(
        identifier,
        t.callExpression(getImportIdentifier(state, path, IMPORT_REGISTRY), []),
      ),
    ]),
  );
  const pathToHot = getHotIdentifier(state);
  const statements: t.Statement[] = [
    t.expressionStatement(
      t.callExpression(getImportIdentifier(state, path, IMPORT_REFRESH), [
        t.stringLiteral(state.opts.bundler ?? 'standard'),
        pathToHot,
        identifier,
      ]),
    ),
  ];

  generateViteHMRRequirement(state, statements, pathToHot);

  (
    path.scope.getProgramParent().path as babel.NodePath<t.Program>
  ).pushContainer('body', [
    t.ifStatement(pathToHot, t.blockStatement(statements)),
  ]);
  state.imports.set(REGISTRY, identifier);
  return identifier;
}
