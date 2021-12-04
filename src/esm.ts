import { createSignal, createMemo, untrack, JSX } from "solid-js";

interface HotComponent<P> {
  (props: P): JSX.Element;
  setComp: (action: () => HotComponent<P>) => void;
  setSign: (action: () => string) => void;
  sign: () => string;
}

interface HotModule {
  $$registrations: Record<string, HotComponent<any>>;
  $$signatures: Record<string, string>;
}

export default function hot<P>(
  Comp: HotComponent<P>,
  id: string,
  isHot: boolean,
) {
  let Component: (props: P) => JSX.Element = Comp;
  function handler(newModule: HotModule) {
    newModule.$$registrations[id].setComp = Comp.setComp;
    newModule.$$registrations[id].setSign = Comp.setSign;
    newModule.$$registrations[id].sign = Comp.sign;
    if (newModule.$$signatures[id] !== Comp.sign()) {
      Comp.setSign(() => newModule.$$signatures[id]);
      Comp.setComp(() => newModule.$$registrations[id]);
    }
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    const [signature, setSignature] = createSignal('');
    Comp.setComp = setComp;
    Comp.setSign = setSignature;
    Comp.sign = signature;
    let c: typeof Comp;
    Component = new Proxy((props: P) => createMemo(() => (c = comp()) && untrack(() => c(props))), {
      get(_, property) {
        return comp()[property];
      }
    });
  }
  return { Component, handler };
}
