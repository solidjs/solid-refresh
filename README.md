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

The components are wrapped and memoized. When the module receives an update, it replaces the old components from the old module with the new components.

## Pragma

On a per file basis, use comments at top of file to opt out(change moves up to parent):

```js
/* @refresh skip */
```

Or force reload:

```js
/* @refresh reload */
```

### `@refresh granular`

By default, components from the old module are replaced with the new ones from the replacement module, which might cause components that hasn't really changed to unmount abruptly.

Adding `@refresh granular` comment pragma in the file allows components to opt-in to granular replacement: If the component has changed *code-wise*, it will be replaced, otherwise, it will be retained, which allows unchanged ancestor components to preserve lifecycles.

The downside of this mode is that local bindings that are part of the module that which the components depends on won't be detected as a change and thus will not trigger a replacement. This also means that the component may be accessing a different instance of that binding (e.g. createContext). This is currently a known limitation.

## Limitations

- Preserving state: The default mode does not allow preserving state through module replacement. `@refresh granular` allows this partially.
- No HOC support.
