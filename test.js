const babel = require('@babel/core');
const plugin = require('./babel');











babel.transformAsync(`
// @refresh reload
export const Foo = () => <h1>Hello Foo</h1>;
export const Bar = () => <h1>Hello Bar</h1>;

export default function (props) {
  return <h1>Hello {props.message}</h1>;
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