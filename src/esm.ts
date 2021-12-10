import { createSignal, JSX } from "solid-js";
import createProxy from "./create-proxy";
import isListUpdated from "./is-list-updated";

interface HotComponent<P> {
  (props: P): JSX.Element;
  setComp: (action: () => HotComponent<P>) => void;
  signature?: string;
  dependencies?: any[];
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
    if (!registration) {
      // For some reason, the registration was lost, invalidate
      return true;
    }
    registration.component.setComp = Comp.setComp;
    registration.component.signature = Comp.signature;
    registration.component.dependencies = Comp.dependencies;

    // Check if incoming module has signature
    if (registration.signature && registration.dependencies) {
      // Compare old signature and dependencies
      if (
        registration.signature !== Comp.signature
        || isListUpdated(registration.dependencies, Comp.dependencies)
      ) {
        // Remount
        Comp.dependencies = registration.dependencies;
        Comp.signature = registration.signature;
        Comp.setComp(() => registration.component);
      }
    } else {
      // No granular update, remount
      Comp.setComp(() => registration.component);
    }

    registration.component.signature = Comp.signature;
    registration.component.dependencies = Comp.dependencies;
    return false;
  }
  if (isHot) {
    const [comp, setComp] = createSignal(Comp);
    Comp.setComp = setComp;
    Comp.dependencies = dependencies;
    Comp.signature = signature;
    Component = createProxy(comp);
  }
  return { Component, handler };
}
