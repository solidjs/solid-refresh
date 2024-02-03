import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/runtime/index.ts',
    output: [
      {
        file: 'dist/solid-refresh.cjs',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: 'dist/solid-refresh.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: ['solid-js'],
    plugins: [nodeResolve(), typescript()],
  },
  {
    input: 'src/babel/index.ts',
    output: [
      {
        file: './dist/babel.cjs',
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: './dist/babel.mjs',
        format: 'es',
        sourcemap: true,
      },
    ],
    external: [
      '@babel/core',
      '@babel/types',
      '@babel/generator',
      'crypto',
    ],
    plugins: [nodeResolve(), typescript()],
  },
];
