import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { IMPORT_DECLINE } from './constants';
import { getHotIdentifier } from './get-hot-identifier';
import { getImportIdentifier } from './get-import-identifier';
import type { StateContext } from './types';

export function getHMRDeclineCall(state: StateContext, path: babel.NodePath) {
  const pathToHot = getHotIdentifier(state);

  if (state.bundler === 'vite') {
    return t.ifStatement(
      pathToHot,
      t.blockStatement([
        t.expressionStatement(
          t.callExpression(
            t.memberExpression(pathToHot, t.identifier('accept')),
            [
              t.arrowFunctionExpression(
                [],
                t.callExpression(
                  t.memberExpression(pathToHot, t.identifier('invalidate')),
                  [],
                ),
              ),
            ],
          ),
        ),
      ]),
    );
  }
  return t.ifStatement(
    pathToHot,
    t.blockStatement([
      t.expressionStatement(
        t.callExpression(getImportIdentifier(state, path, IMPORT_DECLINE), [
          t.stringLiteral(state.bundler),
          pathToHot,
        ]),
      ),
    ]),
  );
}
