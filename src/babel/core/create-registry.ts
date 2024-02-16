import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { IMPORT_REFRESH, IMPORT_REGISTRY } from './constants';
import { getHotIdentifier } from './get-hot-identifier';
import { getImportIdentifier } from './get-import-identifier';
import { getRootStatementPath } from './get-root-statement-path';
import { generateViteHMRRequirement } from './get-vite-hmr-requirement';
import type { StateContext } from './types';

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

  root.scope.registerDeclaration(
    root.insertBefore(
      t.variableDeclaration('const', [
        t.variableDeclarator(
          identifier,
          t.callExpression(
            getImportIdentifier(state, path, IMPORT_REGISTRY),
            [],
          ),
        ),
      ]),
    )[0],
  );
  const pathToHot = getHotIdentifier(state);
  const statements: t.Statement[] = [
    t.expressionStatement(
      t.callExpression(getImportIdentifier(state, path, IMPORT_REFRESH), [
        t.stringLiteral(state.bundler),
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
