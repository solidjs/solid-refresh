import { createSignal, JSX, DEV } from "solid-js";
import createProxy from "./create-proxy";
import isListUpdated from "./is-list-updated";

interface HotData {
  setComp: (action: () => (props: any) => JSX.Element) => void;
  signature?: string;
  dependencies?: any[];
}

interface StandardHot {
  data: Record<string, HotData>;
  accept: () => void;
  dispose: (cb: (data: Record<string, unknown>) => void) => void;
  decline?: () => void;
  invalidate?: () => void;
}

interface HotSignature<P> {
  component: (props: P) => JSX.Element
  id: string;
  signature?: string;
  dependencies?: any[];
}

let warned = false;

export default function hot<P>(
  { component: Comp, id, signature, dependencies }: HotSignature<P>,
  hot: StandardHot,
) {
  if (!(DEV && Object.keys(DEV).length)) {
    if (!warned) {
      console.warn("To use solid-refresh, you need to use the dev build of SolidJS. Make sure your build system supports package.json conditional exports and has the 'development' condition turned on.");
      warned = true;
    }
    if (hot && hot.decline) hot.decline();
  } else if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const prev = hot.data;
    // Check if there's previous data
    if (prev && prev[id]) {
      // Check if there's a new signature and dependency
      // This is always new in standard HMR
      if (signature && dependencies) {
        // Check if signature changed
        // or dependencies changed
        if (
          prev[id].signature !== signature
          || isListUpdated(prev[id].dependencies, dependencies)
        ) {
          // Remount
          prev[id].dependencies = dependencies;
          prev[id].signature = signature;
          prev[id].setComp(() => Comp);
        }
      } else {
        prev[id].setComp(() => Comp);
      }
    }
    hot.dispose(data => {
      data[id] = prev ? prev[id] : {
        setComp,
        signature,
        dependencies,
      };
    });
    hot.accept();
    return createProxy<typeof Comp, P>(comp);
  }
  return Comp;
}
