import type { StateContext } from './types';
import * as t from '@babel/types';

export function getHotIdentifier(state: StateContext): t.MemberExpression {
  switch (state.bundler) {
    // vite/esm/bun uses `import.meta.hot`
    case 'esm':
    case 'vite':
    case 'bun':
      return t.memberExpression(
        t.memberExpression(t.identifier('import'), t.identifier('meta')),
        t.identifier('hot'),
      );
    // webpack 5 uses `import.meta.webpackHot`
    // rspack does as well
    case 'webpack5':
    case 'rspack-esm':
      return t.memberExpression(
        t.memberExpression(t.identifier('import'), t.identifier('meta')),
        t.identifier('webpackHot'),
      );
    default:
      // `module.hot` is the default.
      return t.memberExpression(t.identifier('module'), t.identifier('hot'));
  }
}
