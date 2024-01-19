import * as babel from '@babel/core';
import solid from 'babel-preset-solid';
import plugin from '../src/babel';
import type { RuntimeType } from '../src/shared/types';

export async function transform(
  code: string,
  bundler: RuntimeType,
  mode: 'server' | 'client',
  hydratable: boolean,
) {
  const result = await babel.transformAsync(code, {
    plugins: [[plugin, { bundler }]],
    presets: [
      [solid, { generate: mode === 'server' ? 'ssr' : 'dom', hydratable }],
    ],
    parserOpts: {
      plugins: ['jsx', 'typescript'],
    },
    filename: 'example.jsx',
  });

  if (result && result.code) {
    return result.code;
  }
  throw new Error('Missing code');
}
