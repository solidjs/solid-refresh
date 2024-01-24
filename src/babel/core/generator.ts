import _generator from '@babel/generator';
import type * as t from '@babel/types';

// https://github.com/babel/babel/issues/15269
let generator: typeof _generator;
if (typeof _generator !== 'function') {
  generator = (_generator as any).default;
} else {
  generator = _generator;
}

export function generateCode(node: t.Node): string {
  return generator(node).code;
}
