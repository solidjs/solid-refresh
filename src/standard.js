import { createSignal, createMemo, untrack } from "solid-js";

export default function hot(Comp, id, hot) {
  if (hot) {
    const [comp, setComp] = createSignal(Comp);
    const prev = hot.data;
    if (prev && prev[id].setComp) {
      prev[id].setComp(() => Comp);
    }
    hot.dispose(data => (data[id].setComp = prev[id] ? prev[id].setComp : setComp));
    hot.accept();
    let c;
    return new Proxy(props => createMemo(() => (c = comp()) && untrack(() => c(props))), {
      get(_, property) {
        return comp()[property];
      }
    });
  }
  return Comp;
}
