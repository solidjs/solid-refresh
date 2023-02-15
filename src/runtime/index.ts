
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
  registry.contexts.set(id, {
    id,
    context,
  });
  return context;
}

function patchComponent<P>(
  oldData: ComponentRegistrationData<P>,
  newData: ComponentRegistrationData<P>,
) {
  // Check if incoming module has signature
  if (newData.signature ) {
    // Compare signatures
    if (
      newData.signature !== oldData.signature
      || isListUpdated(newData.dependencies, oldData.dependencies)
    ) {
      // Replace signatures and dependencies
      oldData.dependencies = newData.dependencies;
      oldData.signature = newData.signature;
      // Remount
      oldData.update(() => newData.component);
    }
  } else {
    // No granular update, remount
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
  oldData.context.defaultValue = newData.context.defaultValue;
  newData.context.id = oldData.context.id;
  newData.context.Provider = oldData.context.Provider;
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
  const shouldInvalidateByContext = patchContexts(oldRegistry, newRegistry);
  const shouldInvalidateByComponents = patchComponents(oldRegistry, newRegistry);
  // In the future we may add other HMR features here
  return shouldInvalidateByComponents || shouldInvalidateByContext;
}

const SOLID_REFRESH = 'solid-refresh';
const SOLID_REFRESH_PREV = 'solid-refresh-prev';

type HotData = {
  [key in (typeof SOLID_REFRESH | typeof SOLID_REFRESH_PREV)]: Registry;
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

function hotDecline(hot: StandardHot, timeout = false) {
  if (hot.decline) {
    hot.decline();
  } else if (timeout) {
    setTimeout(() => {
      window.location.reload();
    }, 5000);
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
  hot.data[SOLID_REFRESH] = hot.data[SOLID_REFRESH] || registry;
  hot.data[SOLID_REFRESH_PREV] = registry;

  hot.accept(() => {
    if (patchRegistry(hot.data[SOLID_REFRESH], hot.data[SOLID_REFRESH_PREV])) {
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

type ESMRefresh = [type: 'esm' | 'vite', hot: ESMHot, registry: Registry];
type StandardRefresh = [type: 'standard' | 'webpack5', hot: StandardHot, registry: Registry];

type Refresh = 
  | ESMRefresh
  | StandardRefresh;

export function $$refresh(...[type, hot, registry]: Refresh) {
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
        hotDecline(hot, true);
      }
      $$refreshStandard(hot, registry);
      break;
  }
}
// if (import.meta.hot) {
//   $$refresh({ type, hot: import.meta.hot }, registry);
// }

