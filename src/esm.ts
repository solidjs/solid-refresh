import { createSignal, JSX } from "solid-js";
import createProxy from "./create-proxy";
import isListUpdated from "./is-list-updated";

interface HotComponent<P> {
  (props: P): JSX.Element;
  setComp: (action: () => HotComponent<P>) => void;
  setSign: (action: () => string | undefined) => void;
  sign: () => string | undefined;
  setDeps: (action: () => any[] | undefined) => void;
  deps: () => any[] | undefined;
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
  mode: 'reload' | 'granular' | 'none',
) {
  let Component: (props: P) => JSX.Element = Comp;
  function handler(newModule: HotModule<P>) {
    const registration = newModule.$$registrations[id];
    if (!registration) {
      // For some reason, the registration was lost, invalidate
      return true;
    }
    registration.component.setComp = Comp.setComp;
    registration.component.setSign = Comp.setSign;
    registration.component.sign = Comp.sign;
    registration.component.setDeps = Comp.setDeps;
    registration.component.deps = Comp.deps;

    // Check if incoming module has signature
    if (registration.signature && registration.dependencies) {
      // Compare old signature and dependencies
      if (
        registration.signature !== Comp.sign()
        || isListUpdated(registration.dependencies, Comp.deps())
      ) {
        if (mode === 'reload') {
          return true;
        }
        // Remount
        Comp.setDeps(() => registration.dependencies);
        Comp.setSign(() => registration.signature);
        Comp.setComp(() => registration.component);
      }
    } else if (mode === 'reload') {
      return true;
    } else {
      // No granular update, remount
      Comp.setComp(() => registration.component);
    }
    return false;
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    const [sign, setSign] = createSignal(signature);
    Comp.setSign = setSign;
    Comp.sign = sign;
    const [deps, setDeps] = createSignal(dependencies);
    Comp.setDeps = setDeps;
    Comp.deps = deps;
    Component = createProxy(comp);
  }
  return { Component, handler };
}
