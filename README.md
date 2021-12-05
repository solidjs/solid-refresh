# Solid Refresh

This project aims to provide HMR for Solid for various bundlers. It comes with a babel plugin and a runtime. Over time I hope to add different bundlers. Today it supports:

* Webpack
* Parcel
* Rollup/Nollup (need to confirm)

* Vite (with option `bundler: "esm"`)
* Snowpack (with option `bundler: "esm"`, need to confirm)

## How it works

The babel plugin will transform components with matching Pascal-cased names (indicating that they are components). This detection is supported in variable declarations, function declarations and named exports:

```jsx
// This works
function Foo() {
  return <h1>Hello Foo</h1>;
}

// This also works
const Bar = () => <h1>Hello Bar</h1>;
```

Anonymous functions with `props` as the only parameter are also supported.

```js
// This also works
export default function (props) {
  return <h1>Hello Anonymous!</h1>;
}
```

The components are wrapped and memoized. When the module receives an update, it tries to detect if the component's content has changed between updates, prompting a remount for the changed component (which allows the ancestor components to retain their lifecycle.).

## Pragma

On a per file basis, use comments at top of file to opt out(change moves up to parent):

```js
/* @refresh skip */
```

Or force reload:

```js
/* @refresh reload */
```
