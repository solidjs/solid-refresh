import { createSignal, createMemo, untrack, JSX } from "solid-js";
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
) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const [sign, setSign] = createSignal(signature);
    const [deps, setDeps] = createSignal(dependencies);
    const prev = hot.data;
    // Check if there's previous data
    if (
      prev
      && prev[id]
    ) {
      // Check if there's a new signature and dependency
      // This is always new in standard HMR
      if (signature && dependencies) {
        // Check if signature changed
        // or dependencies changed
        if (
          prev[id].sign() !== signature
          || isListUpdated(prev[id].deps(), dependencies)
        ) {
          // Remount
          prev[id].setDeps(() => dependencies);
          prev[id].setSign(() => signature);
          prev[id].setComp(() => Comp);
        }
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
    return new Proxy((props: P) => (
      createMemo(() => {
        const c = comp();
        if (c) {
          return untrack(() => c(props));
        }
        return undefined;
      })
    ), {
      get(_, property: keyof typeof Comp) {
        return comp()[property];
      }
    });
  }
  return Comp;
}
