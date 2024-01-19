import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type { StateContext } from './types';
import { getHotIdentifier } from './get-hot-identifier';
import { getImportIdentifier } from './get-import-identifier';
import { IMPORT_DECLINE } from './constants';
import { generateViteHMRRequirement } from './get-vite-hmr-requirement';

export function getHMRDeclineCall(state: StateContext, path: babel.NodePath) {
  const pathToHot = getHotIdentifier(state);
  const statements = [
    t.expressionStatement(
      t.callExpression(getImportIdentifier(state, path, IMPORT_DECLINE), [
        t.stringLiteral(state.opts.bundler ?? 'standard'),
        pathToHot,
      ]),
    ),
  ];

  generateViteHMRRequirement(state, statements, pathToHot);

  return t.ifStatement(pathToHot, t.blockStatement(statements));
}
