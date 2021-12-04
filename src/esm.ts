import { createSignal, createMemo, untrack, JSX } from "solid-js";

interface ESMHot {
  data: Record<string, (action: () => (props: any) => JSX.Element) => void>;
  accept: (cb: () => void) => void;
  dispose: (cb: (data: Record<string, unknown>) => void) => void;
}

export default function hot<P>(
  Comp: (props: P) => JSX.Element,
  id: string,
  hot: ESMHot,
) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    hot.accept(() => {
      const prev = hot.data;
      if (prev && prev[id]) {
        prev[id](() => Comp);
      }
    });
    hot.dispose(() => (hot.data[id] = hot.data[id] || setComp));
    let c: typeof Comp;
    return new Proxy((props: P) => createMemo(() => (c = comp()) && untrack(() => c(props))), {
      get(_, property) {
        return comp()[property];
      }
    });
  }
  return Comp;
}
