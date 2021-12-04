import { createSignal, createMemo, untrack, JSX } from "solid-js";

interface StandardHot {
  data: Record<string, (action: () => (props: any) => JSX.Element) => void>;
  accept: () => void;
  dispose: (cb: (data: Record<string, unknown>) => void) => void;
}

export default function hot<P>(
  Comp: (props: P) => JSX.Element,
  id: string,
  hot: StandardHot,
) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const prev = hot.data;
    if (prev && prev[id]) {
      prev[id](() => Comp);
    }
    hot.dispose(data => (data[id] = prev[id] || setComp));
    hot.accept();
    let c: typeof Comp;
    return new Proxy((props: P) => createMemo(() => (c = comp()) && untrack(() => c(props))), {
      get(_, property) {
        return comp()[property];
      }
    });
  }
  return Comp;
}
