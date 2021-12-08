import { createSignal, JSX } from "solid-js";
import createProxy from "./create-proxy";
import isListUpdated from "./is-list-updated";

interface HotData {
  setComp: (action: () => (props: any) => JSX.Element) => void;
  setSign: (action: () => string | undefined) => void;
  sign: () => string | undefined;
  setDeps: (action: () => any[] | undefined) => void;
  deps: () => any[] | undefined;
}

interface StandardHot {
  data: Record<string, HotData>;
  accept: () => void;
  dispose: (cb: (data: Record<string, unknown>) => void) => void;
  decline?: () => void;
  invalidate?: () => void;
}

function invalidate(hot: StandardHot) {
  // Some Webpack-like HMR doesn't have `invalidate` or `decline`
  // methods (e.g. Parcel) so we need to shim this module invalidation
  // by calling either of the two methods (if it exists) or reloading
  // the entire page
  if (hot.invalidate) {
    hot.invalidate();
  } else if (hot.decline) {
    hot.decline();
  } else if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

interface HotSignature<P> {
  component: (props: P) => JSX.Element
  id: string;
  signature?: string;
  dependencies?: any[];
}

export default function hot<P>(
  { component: Comp, id, signature, dependencies }: HotSignature<P>,
  hot: StandardHot,
  shouldReload: boolean,
) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const [sign, setSign] = createSignal(signature);
    const [deps, setDeps] = createSignal(dependencies);
    const prev = hot.data;
    // Check if there's previous data
    if (prev && prev[id]) {
      // Check if there's a new signature and dependency
      // This is always new in standard HMR
      if (signature && dependencies) {
        // Check if signature changed
        // or dependencies changed
        if (
          prev[id].sign() !== signature
          || isListUpdated(prev[id].deps(), dependencies)
        ) {
          if (shouldReload) {
            invalidate(hot);
          } else {
            // Remount
            prev[id].setDeps(() => dependencies);
            prev[id].setSign(() => signature);
            prev[id].setComp(() => Comp);
          }
        }
      } else if (shouldReload) {
        invalidate(hot);
      } else {
        prev[id].setComp(() => Comp);
      }
    }
    hot.dispose(data => {
      data[id] = prev ? prev[id] : {
        setComp,
        sign,
        setSign,
        deps,
        setDeps,
      };
    });
    hot.accept();
    return createProxy<typeof Comp, P>(comp);
  }
  return Comp;
}
