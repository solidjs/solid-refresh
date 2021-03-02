import { createSignal, createMemo, untrack } from "solid-js";

export default function hot(Comp, accept) {
  if (accept) {
    accept((newModule) => {
      newModule.$HotComponent.setComp = Comp.setComp;
      Comp.setComp(newModule.$HotComponent);
    });
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    let c;
    return props => createMemo(() => (c = comp()) && untrack(() => c(props)));
  }
  return Comp;
}