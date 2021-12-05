import { createSignal, createMemo, untrack, JSX } from "solid-js";

interface HotComponent<P> {
  (props: P): JSX.Element;
  setComp: (action: () => HotComponent<P>) => void;
  setSign: (action: () => string) => void;
  sign: () => string;
}

interface HotRegistration<P> {
  component: HotComponent<P>;
  signature: string;
}

interface HotModule<P> {
  $$registrations: Record<string, HotRegistration<P>>;
}

export default function hot<P>(
  Comp: HotComponent<P>,
  id: string,
  initialSignature: string,
  isHot: boolean,
) {
  let Component: (props: P) => JSX.Element = Comp;
  function handler(newModule: HotModule<P>) {
    const registration = newModule.$$registrations[id];
    registration.component.setComp = Comp.setComp;
    registration.component.setSign = Comp.setSign;
    registration.component.sign = Comp.sign;
    //if (registration.signature !== Comp.sign()) {
    Comp.setSign(() => registration.signature);
    Comp.setComp(() => registration.component);
    //}
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    const [signature, setSignature] = createSignal(initialSignature);
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
