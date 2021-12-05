import { createSignal, createMemo, untrack, JSX } from "solid-js";

interface HotData {
  setComp: (action: () => (props: any) => JSX.Element) => void;
  setSign: (action: () => string) => void;
  sign: () => string;
}

interface StandardHot {
  data: Record<string, HotData>;
  accept: () => void;
  dispose: (cb: (data: Record<string, unknown>) => void) => void;
}

export default function hot<P>(
  Comp: (props: P) => JSX.Element,
  id: string,
  initialSignature: string | undefined,
  hot: StandardHot,
) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const prev = hot.data;
    if (initialSignature) {
      const [sign, setSign] = createSignal(initialSignature);
      if (prev && prev[id] && prev[id].sign() !== initialSignature) {
        prev[id].setSign(() => initialSignature);
        prev[id].setComp(() => Comp);
      }
      hot.dispose(data => {
        data[id] = prev ? prev[id] : {
          setComp,
          sign,
          setSign,
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
