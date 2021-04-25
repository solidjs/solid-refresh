# Solid Refresh

This project aims to provide HMR for Solid for various bundlers. It comes with a babel plugin and a runtime. Over time I hope to add different bundlers. Today it supports:

* Webpack
* Parcel
* Rollup/Nollup

* Vite (with option `bundler: "esm"`)
## How it works

The babel plugin will transform files with `.jsx` or `.tsx` extensions with default exports (assuming they are component files) to wrap the default export with `createMemo` call so component can be swapped at will.

Today we don't preserve state below the change.

