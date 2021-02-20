import { createSignal, createMemo, createComponent } from "solid-js";

export default function hot(Comp, accept) {
  if (accept) {
    accept((newModule) => {
      newModule.$HotComponent.setComp = Comp.setComp;
      Comp.setComp(newModule.$HotComponent);
    });
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    return (props) => createMemo(() => createComponent(comp(), props));
  }
  return Comp;
}