import { createSignal, createMemo, untrack, JSX } from "solid-js";
import isListUpdated from "./is-list-updated";

interface HotData {
  setComp: (action: () => (props: any) => JSX.Element) => void;
  setSign: (action: () => string) => void;
  sign: () => string;
  setDeps: (action: () => any[]) => void;
  deps: () => any[];
}

interface StandardHot {
  data: Record<string, HotData>;
  accept: () => void;
  dispose: (cb: (data: Record<string, unknown>) => void) => void;
}

interface HotSignature {
  id: string;
  value?: string;
  dependencies?: any[];
}

export default function hot<P>(
  Comp: (props: P) => JSX.Element,
  { id, value, dependencies }: HotSignature,
  hot: StandardHot,
) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const prev = hot.data;
    if (value && dependencies) {
      const [sign, setSign] = createSignal(value);
      const [deps, setDeps] = createSignal(dependencies);
      if (prev
          && prev[id]
          && (prev[id].sign() !== value
            || isListUpdated(prev[id].deps(), dependencies)
          )
        ) {
        prev[id].setDeps(() => dependencies);
        prev[id].setSign(() => value);
        prev[id].setComp(() => Comp);
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
    } else {
      if (prev && prev[id]) {
        prev[id].setComp(() => Comp);
      }
      hot.dispose(data => {
        data[id] = prev ? prev[id] : {
          setComp,
        };
      });
    }
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
