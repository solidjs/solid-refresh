import { createSignal, createMemo, untrack } from "solid-js";

export default function hot(Comp, id, isHot) {
  let Component = Comp;
  function handler(newModule) {
    newModule.$$registrations[id].setComp = Comp.setComp;
    Comp.setComp(() => newModule.$$registrations[id]);
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    let c;
    Component = new Proxy(props => createMemo(() => (c = comp()) && untrack(() => c(props))), {
      get(_, property) {
        return comp()[property];
      }
    });
  }
  return { Component, handler };
}
