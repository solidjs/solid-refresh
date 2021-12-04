import { createSignal, createMemo, untrack, JSX } from "solid-js";

interface HotComponent<P> {
  (props: P): JSX.Element;
  setComp: (action: () => HotComponent<P>) => void;
}

interface HotModule {
  $$registrations: Record<string, HotComponent<any>>;
}

export default function hot<P>(
  Comp: HotComponent<P>,
  id: string,
  isHot: boolean,
) {
  let Component: (props: P) => JSX.Element = Comp;
  function handler(newModule: HotModule) {
    newModule.$$registrations[id].setComp = Comp.setComp;
    Comp.setComp(() => newModule.$$registrations[id]);
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    let c: typeof Comp;
    Component = new Proxy((props: P) => createMemo(() => (c = comp()) && untrack(() => c(props))), {
      get(_, property) {
        return comp()[property];
      }
    });
  }
  return { Component, handler };
}
