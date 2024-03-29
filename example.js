import * as babel from '@babel/core';
import plugin from 'solid-refresh/babel';
import { readFile } from 'node:fs/promises';

async function compile(code) {
  const result = await babel.transformAsync(code, {
    plugins: [[plugin, { bundler: 'vite' }]],
    parserOpts: {
      plugins: ['jsx', 'typescript'],
    },
    filename: 'input.js',
    sourceFileName: 'input.js',
    sourceMaps: true,
  });

  return result?.code ?? '';
}

console.log(await compile(await readFile('./input.js', 'utf-8')));
