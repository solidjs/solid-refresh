
import { Context, createSignal, DEV, JSX } from "solid-js";
import createProxy from "./create-proxy";
import isListUpdated from "./is-list-updated";

// The registration data for the components
export interface ComponentRegistrationData<P> {
  // A compile-time ID generated for the component, this is usually
  // derived from the component's name
  id: string;
  // The component itself
  component: (props: P) => JSX.Element;
  // This function replaces the previous component
  // with the new component.
  update: (action: () => (props: P) => JSX.Element) => void;
  // In granular mode. This signature is a hash
  // generated from the component's JS string
  signature?: string;
  // An array of foreign bindings (values that aren't locally declared in the component)
  dependencies?: any[];
}

// The registration data for the context
export interface ContextRegistrationData<T> {
  // A compile-time ID generated for the context, this is usually
  // derived from the context's name
  id: string;
  // The context instance
  context: Context<T>;
  // This function replaces the previous context with the new context
  update: (action: () => Context<T>) => void;
}

export interface Registry {
  components: Map<string, ComponentRegistrationData<any>>;
  contexts: Map<string, ContextRegistrationData<any>>;
}

export function $$registry(): Registry {
  return {
    components: new Map(),
    contexts: new Map(),
  };
}

interface ComponentOptions {
  signature?: string;
  dependencies?: any[];
}

export function $$component<P>(
  registry: Registry,
  id: string,
  component: (props: P) => JSX.Element,
  options: ComponentOptions = {},
): (props: P) => JSX.Element {
  const [comp, setComp] = createSignal(component, { internal: true });
  const proxyComponent = createProxy<(props: P) => JSX.Element, P>(comp);
  registry.components.set(id, {
    id,
    component: proxyComponent,
    update: setComp,
    ...options,
  });
  return proxyComponent;
}

export function $$context<T>(
  registry: Registry,
  id: string,
  context: Context<T>,
): Context<T> {
  const [ctx, setCtx] = createSignal(context, { internal: true });
  const proxyContext: Context<T> = {
    get defaultValue() {
      return ctx().defaultValue;
    },
    id: ctx().id,
    Provider: ctx().Provider,
  };
  registry.contexts.set(id, {
    id,
    context: proxyContext,
    update: setCtx,
  });
  return proxyContext;
}

function patchComponent<P>(
  oldData: ComponentRegistrationData<P>,
  newData: ComponentRegistrationData<P>,
) {
  // Check if incoming module has signature
  if (newData.signature && newData.dependencies) {
    // Compare old signature and dependencies
    if (
      newData.signature !== oldData.signature ||
      isListUpdated(newData.dependencies, oldData.dependencies)
    ) {
      // Remount
      oldData.dependencies = newData.dependencies;
      oldData.signature = newData.signature;
      oldData.update(() => newData.component);
    }
  // No granular update, remount
  } else {
    oldData.update(() => newData.component);
  }
}

function patchComponents(
  oldData: Registry,
  newData: Registry,
) {
  const components = oldData.components.keys();
  for (const key of components) {
    const oldComponent = oldData.components.get(key);
    const newComponent = newData.components.get(key);

    if (oldComponent) {
      if (newComponent) {
        patchComponent(oldComponent, newComponent);
      } else {
        // We need to invalidate
        return true;
      }
    } else if (newComponent) {
      oldData.components.set(key, newComponent);
    }
  }
  return false;
}

function patchContext<T>(
  oldData: ContextRegistrationData<T>,
  newData: ContextRegistrationData<T>,
) {
  if (oldData.update) {
    newData.context.id = oldData.context.id;
    newData.context.Provider = oldData.context.Provider;
    oldData.update(() => newData.context);
  }
}

function patchContexts(
  oldData: Registry,
  newData: Registry,
) {
  const contexts = oldData.contexts.keys();
  for (const key of contexts) {
    const oldContext = oldData.contexts.get(key);
    const newContext = newData.contexts.get(key);

    if (oldContext) {
      if (newContext) {
        patchContext(oldContext, newContext);
      } else {
        // We need to invalidate
        return true;
      }
    } else if (newContext) {
      oldData.contexts.set(key, newContext);
    }
  }
  return false;
}

function patchRegistry(
  oldRegistry: Registry,
  newRegistry: Registry
) {
  const shouldInvalidateByComponents = patchComponents(oldRegistry, newRegistry);
  const shouldInvalidateByContext = patchContexts(oldRegistry, newRegistry);
  // In the future we may add other HMR features here
  return shouldInvalidateByComponents || shouldInvalidateByContext;
}

const SOLID_REFRESH = 'solid-refresh';

type HotData = {
  [key in typeof SOLID_REFRESH]?: Registry;
};

interface ESMHot {
  data: HotData;
  accept: (cb: () => void) => void;
  invalidate: () => void;
  decline: () => void;
}

interface StandardHot {
  data: HotData;
  accept: () => void;
  dispose: (cb: (data: HotData) => void) => void;
  invalidate?: () => void;
  decline?: () => void;
}

function hotDecline(hot: StandardHot) {
  if (hot.decline) {
    hot.decline();
  } else {
    window.location.reload();
  }
}

function hotInvalidate(hot: StandardHot) {
  // Some bundlers have no invalidate/decline
  // so try `invalidate` first, then `decline`
  // and if none of it exists, reload the page
  if (hot.invalidate) {
    hot.invalidate();
  } else {
    hotDecline(hot);
  }
}

function $$refreshESM(hot: ESMHot, registry: Registry) {
  hot.data[SOLID_REFRESH] = registry;

  hot.accept(() => {
    const nextRegistry = hot.data[SOLID_REFRESH];
    if (nextRegistry && patchRegistry(registry, nextRegistry)) {
      hot.invalidate();
    }
  });

  return false;
}

function $$refreshStandard(hot: StandardHot, registry: Registry) {
  const current = hot.data;
  if (current && current[SOLID_REFRESH]) {
    if (patchRegistry(current[SOLID_REFRESH], registry)) {
      hotInvalidate(hot);
    }
  }
  hot.dispose((data: HotData) => {
    data[SOLID_REFRESH] = current ? current[SOLID_REFRESH] : registry;
  });
  hot.accept();
}

interface ESMHotContext {
  type: 'esm' | 'vite';
  hot: ESMHot;
}
interface StandardHotContext {
  type: 'standard' | 'webpack5';
  hot: StandardHot;
}

let warned = false;

function shouldWarnAndDecline() {
  const result = DEV && Object.keys(DEV).length;

  if (result) {
    return false;
  }

  if (!warned) {
    console.warn(
      "To use solid-refresh, you need to use the dev build of SolidJS. Make sure your build system supports package.json conditional exports and has the 'development' condition turned on."
    );
    warned = true;
  }
  return true;
}

export function $$refresh(ctx: ESMHotContext, registry: Registry): void;
export function $$refresh(ctx: StandardHotContext, registry: Registry): void;
export function $$refresh(
  { type, hot }: ESMHotContext | StandardHotContext,
  registry: Registry,
) {
  switch (type) {
    case 'esm':
    case 'vite':
      if (shouldWarnAndDecline()) {
        hot.decline();
      }
      $$refreshESM(hot, registry);
      break;
    case 'standard':
    case 'webpack5':
      if (shouldWarnAndDecline()) {
        hotDecline(hot);
      }
      $$refreshStandard(hot, registry);
      break;
  }
}
// if (import.meta.hot) {
//   $$refresh({ type, hot: import.meta.hot }, registry);
// }

