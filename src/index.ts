import { DEV } from "solid-js";

export { default as standard } from "./standard";
export { default as esm } from "./esm";

let warned = false;

export function shouldWarnAndDecline(): boolean {
  const result = DEV && Object.keys(DEV).length;

  if (result) {
    return false;
  }

  if (!warned) {
    console.warn(
      "To use solid-refresh, you need to use the dev build of SolidJS. Make sure your build system supports package.json conditional exports and has the 'development' condition turned on."
    );
    warned = true;
  }
  return true;
}
