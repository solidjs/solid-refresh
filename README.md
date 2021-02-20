# Solid Refresh

This project aims to provide HMR for Solid for various bundlers. It comes with a babel plugin and a runtime. Overtime I hope to add different bundlers. Today it supports:

* Vite

## How it works

The babel plugin will transform files with default exports (assuming they are component files) to wrap the default export with `createMemo` call so component can be swapped at will. For that reason I recommend restricting this transformation to `.jsx` files.

Today we don't preserve state below the change.