import nodeResolve from "@rollup/plugin-node-resolve";

const plugins = [
  nodeResolve()
];

export default {
  input: 'src/index.js',
  output: [{
    file: 'dist/solid-refresh.js',
    format: 'cjs'
  }, {
    file: 'dist/solid-refresh.mjs',
    format: 'es'
  }],
  external: ['solid-js'],
  plugins
};