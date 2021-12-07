const babel = require('@babel/core');
const plugin = require('./babel');








babel.transformAsync(`
// @refresh local-granular
function Foo() {
  return <h1>{foo} {bar} {baz}</h1>
}
`, {
  plugins: [
    [plugin, { bundler: 'esm' }],
  ],
  parserOpts: {
    plugins: [
      'jsx'
    ]
  }
}).then((output) => console.log(output.code));