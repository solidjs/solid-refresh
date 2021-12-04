import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from '@rollup/plugin-typescript'

export default [
  {
    input: 'src/index.js',
    output: [{
      file: 'dist/solid-refresh.js',
      format: 'cjs'
    }, {
      file: 'dist/solid-refresh.mjs',
      format: 'es'
    }],
    external: ['solid-js'],
    plugins: [
      nodeResolve()
    ]
  },
  {
    input: 'babel/index.ts',
    output: [{
      file: './babel.js',
      format: 'cjs',
    }],
    external: ['@babel/core', '@babel/types', '@babel/helper-module-imports'],
    plugins: [
      nodeResolve(),
      typescript(),
    ]
  }
];