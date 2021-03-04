import { createSignal, createMemo, untrack } from "solid-js";

export default function hot(Comp, isHot) {
  let _$Component = Comp;
  function _$handler(newModule) {
    newModule.$HotComponent.setComp = Comp.setComp;
    Comp.setComp(newModule.$HotComponent);
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    let c;
    _$Component = props => createMemo(() => (c = comp()) && untrack(() => c(props)));
  }
  return { _$Component, _$handler };
}
