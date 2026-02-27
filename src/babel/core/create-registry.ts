import type * as babel from '@babel/core';
import * as t from '@babel/types';
import {
  IMPORT_PATCH_REGISTRY,
  IMPORT_REFRESH,
  IMPORT_REGISTRY,
} from './constants';
import { getHotIdentifier } from './get-hot-identifier';
import { getImportIdentifier } from './get-import-identifier';
import { getRootStatementPath } from './get-root-statement-path';
import type { StateContext } from './types';

const REGISTRY = 'REGISTRY';
const SOLID_REFRESH = 'solid-refresh';
const SOLID_REFRESH_PREV = 'solid-refresh-prev';

function createBunInlineHMR(
  state: StateContext,
  path: babel.NodePath,
  registryId: t.Identifier,
): t.Statement[] {
  const hotMeta = getHotIdentifier(state);
  const patchRegistryId = getImportIdentifier(
    state,
    path,
    IMPORT_PATCH_REGISTRY,
  );
  const hotData = t.memberExpression(hotMeta, t.identifier('data'));
  const hotDataRefresh = t.memberExpression(
    hotData,
    t.stringLiteral(SOLID_REFRESH),
    true,
  );
  const hotDataPrev = t.memberExpression(
    hotData,
    t.stringLiteral(SOLID_REFRESH_PREV),
    true,
  );
  const assignRefresh = t.expressionStatement(
    t.assignmentExpression(
      '=',
      hotDataRefresh,
      t.logicalExpression('||', hotDataRefresh, registryId),
    ),
  );
  const assignPrev = t.expressionStatement(
    t.assignmentExpression('=', hotDataPrev, registryId),
  );
  const modParam = t.identifier('mod');
  const acceptCallback = t.arrowFunctionExpression(
    [modParam],
    t.blockStatement([
      t.ifStatement(
        t.logicalExpression(
          '||',
          t.binaryExpression('==', modParam, t.nullLiteral()),
          t.callExpression(patchRegistryId, [hotDataRefresh, hotDataPrev]),
        ),
        t.blockStatement([
          t.expressionStatement(
            t.callExpression(
              t.memberExpression(
                t.memberExpression(
                  t.identifier('window'),
                  t.identifier('location'),
                ),
                t.identifier('reload'),
              ),
              [],
            ),
          ),
        ]),
      ),
    ]),
  );
  const acceptCall = t.expressionStatement(
    t.callExpression(t.memberExpression(hotMeta, t.identifier('accept')), [
      acceptCallback,
    ]),
  );
  return [assignRefresh, assignPrev, acceptCall];
}

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
  const programPath = path.scope.getProgramParent()
    .path as babel.NodePath<t.Program>;

  if (state.bundler === 'bun') {
    const bunHMRStatements = createBunInlineHMR(state, path, identifier);
    programPath.pushContainer('body', [
      t.ifStatement(pathToHot, t.blockStatement(bunHMRStatements)),
    ]);
  } else {
    programPath.pushContainer('body', [
      t.ifStatement(
        pathToHot,
        t.blockStatement([
          t.expressionStatement(
            t.callExpression(getImportIdentifier(state, path, IMPORT_REFRESH), [
              t.stringLiteral(state.bundler),
              pathToHot,
              identifier,
            ]),
          ),
        ]),
      ),
    ]);
  }

  state.imports.set(REGISTRY, identifier);
  return identifier;
}
