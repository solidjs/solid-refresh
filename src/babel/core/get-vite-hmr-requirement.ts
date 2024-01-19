import type { StateContext } from './types';
import * as t from '@babel/types';

export function generateViteHMRRequirement(
  state: StateContext,
  statements: t.Statement[],
  pathToHot: t.Expression,
) {
  if (state.opts.bundler === 'vite') {
    // Vite requires that the owner module has an `import.meta.hot.accept()` call
    statements.push(
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(pathToHot, t.identifier('accept')),
          [],
        ),
      ),
    );
  }
}
