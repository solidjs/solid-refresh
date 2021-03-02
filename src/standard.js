import { createSignal, createMemo, untrack } from "solid-js";

export default function hot(Comp, hot) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const prev = hot.data;
    if (prev && prev.setComp) {
      prev.setComp(Comp);
    }
    hot.dispose(data => (data.setComp = prev ? prev.setComp : setComp));
    hot.accept();
    let c;
    return props => createMemo(() => (c = comp()) && untrack(() => c(props)));
  }
  return Comp;
}
