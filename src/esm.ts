import { createSignal, createMemo, untrack, JSX } from "solid-js";
import isListUpdated from "./is-list-updated";

interface HotComponent<P> {
  (props: P): JSX.Element;
  setComp: (action: () => HotComponent<P>) => void;
  setSign: (action: () => string) => void;
  sign: () => string;
  setDeps: (action: () => any[]) => void;
  deps: () => any[];
}

interface HotSignature<P> {
  component: HotComponent<P>;
  id: string;
  signature?: string;
  dependencies?: any[];
}

interface HotModule<P> {
  $$registrations: Record<string, HotSignature<P>>;
}

export default function hot<P>(
  { component: Comp, id, signature, dependencies }: HotSignature<P>,
  isHot: boolean,
) {
  let Component: (props: P) => JSX.Element = Comp;
  function handler(newModule: HotModule<P>) {
    const registration = newModule.$$registrations[id];
    registration.component.setComp = Comp.setComp;
    if (signature) {
      registration.component.setSign = Comp.setSign;
      registration.component.sign = Comp.sign;
      registration.component.setDeps = Comp.setDeps;
      registration.component.deps = Comp.deps;
      if (
        !registration.signature
        || registration.signature !== Comp.sign()
        || isListUpdated(registration.dependencies ?? [], Comp.deps())
      ) {
        Comp.setDeps(() => registration.dependencies ?? []);
        Comp.setSign(() => registration.signature ?? '');
        Comp.setComp(() => registration.component);
      }
    } else {
      Comp.setComp(() => registration.component);
    }
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    if (signature) {
      const [sign, setSign] = createSignal(signature);
      Comp.setSign = setSign;
      Comp.sign = sign;
    }
    if (dependencies) {
      const [deps, setDeps] = createSignal(dependencies);
      Comp.setDeps = setDeps;
      Comp.deps = deps;
    }
    Component = new Proxy((props: P) => (
      createMemo(() => {
        const c = comp();
        if (c) {
          return untrack(() => c(props));
        }
        return undefined;
      })
    ), {
      get(_, property: keyof typeof Comp) {
        return comp()[property];
      }
    });
  }
  return { Component, handler };
}
