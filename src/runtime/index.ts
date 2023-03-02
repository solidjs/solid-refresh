
import { Context, createSignal, DEV, JSX } from "solid-js";
import createProxy from "./create-proxy";
import isListUpdated from "./is-list-updated";

interface ComponentOptions {
  location?: string;
  // In granular mode. This signature is a hash
  // generated from the component's JS string
  signature?: string;
  // An array of foreign bindings (values that aren't locally declared in the component)
  dependencies?: Record<string, any>;
}

// The registration data for the components
export interface ComponentRegistrationData<P> extends ComponentOptions {
  // A compile-time ID generated for the component, this is usually
  // derived from the component's name
  id: string;
  // The component itself
  component: (props: P) => JSX.Element;
  proxy: (props: P) => JSX.Element;
  // This function replaces the previous component
  // with the new component.
  update: (action: () => (props: P) => JSX.Element) => void;
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

export function $$component<P>(
  registry: Registry,
  id: string,
  component: (props: P) => JSX.Element,
  options: ComponentOptions = {},
): (props: P) => JSX.Element {
  const [comp, setComp] = createSignal(component, { internal: true });
  const proxy = createProxy<(props: P) => JSX.Element, P>(comp, id, options.location);
  registry.components.set(id, {
    id,
    component,
    proxy,
    update: setComp,
    ...options,
  });
  return proxy;
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

  // Always rely on the first proxy
  // This is to allow modules newly importing
  // the updated version to still be able
  // to render the latest version despite
  // not receiving the first proxy
  newData.update(() => oldData.proxy);
}

function patchComponents(
  oldData: Registry,
  newData: Registry,
) {
  const components = new Set([
    ...oldData.components.keys(),
    ...newData.components.keys(),
  ]);
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
  const contexts = new Set([
    ...oldData.contexts.keys(),
    ...newData.contexts.keys(),
  ]);
  for (const key of contexts.keys()) {
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
  accept: (cb: (module?: unknown) => void) => void;
  invalidate: () => void;
  decline: () => void;
}

interface StandardHot {
  data: HotData;
  accept: (cb?: () => void) => void;
  dispose: (cb: (data: HotData) => void) => void;
  invalidate?: () => void;
  decline?: () => void;
}

// For HMRs that follows Snowpack's spec
// https://github.com/FredKSchott/esm-hmr
type ESMType = 'esm' | 'vite';

// For HMRs that follow Webpack's design
type StandardType = 'standard' | 'webpack5';

type ESMDecline = [type: ESMType, hot: ESMHot, inline?: boolean];
type StandardDecline = [type: StandardType, hot: StandardHot, inline?: boolean];
type Decline =
  | ESMDecline
  | StandardDecline;

export function $$decline(...[type, hot, inline]: Decline) {
  switch (type) {
    case 'esm':
      // Snowpack's ESM assumes invalidate as a normal page reload
      // decline should be better
      if (inline) {
        hot.decline();
      } else {
        hot.invalidate();
      }
      break;
    case 'vite':
      // Vite is no-op on decline, just call invalidate
      if (inline) {
        hot.invalidate();
      } else {
        hot.accept(() => {
          hot.invalidate();
        });
      }
      break;
    case 'webpack5':
      // Webpack has invalidate however it may lead to recursion
      // decline is safer
      if (inline) {
        hot.invalidate!();
      } else {
        hot.decline!();
      }
      break;
    case 'standard':
      // Some implementations do not have decline
      if (hot.decline) {
        hot.decline();
      } else if (inline) {
        window.location.reload();
      } else {
        hot.accept(() => {
          window.location.reload();
        });
      }
      break;
  }
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

function $$refreshESM(type: ESMType, hot: ESMHot, registry: Registry) {
  if (shouldWarnAndDecline()) {
    $$decline(type, hot);
  } else {
    hot.data[SOLID_REFRESH] = hot.data[SOLID_REFRESH] || registry;
    hot.data[SOLID_REFRESH_PREV] = registry;
  
    hot.accept((mod) => {
      if (mod == null || patchRegistry(hot.data[SOLID_REFRESH], hot.data[SOLID_REFRESH_PREV])) {
        hot.invalidate();
      }
    });
  }
}

function $$refreshStandard(type: StandardType, hot: StandardHot, registry: Registry) {
  if (shouldWarnAndDecline()) {
    $$decline(type, hot);
  } else {
    const current = hot.data;
    if (current && current[SOLID_REFRESH]) {
      if (patchRegistry(current[SOLID_REFRESH], registry)) {
        $$decline(type, hot, true);
      }
    }
    hot.dispose((data: HotData) => {
      data[SOLID_REFRESH] = current ? current[SOLID_REFRESH] : registry;
    });
    hot.accept();
  }
}

type ESMRefresh = [type: ESMType, hot: ESMHot, registry: Registry];
type StandardRefresh = [type: StandardType, hot: StandardHot, registry: Registry];

type Refresh = 
  | ESMRefresh
  | StandardRefresh;

export function $$refresh(...[type, hot, registry]: Refresh) {
  switch (type) {
    case 'esm':
    case 'vite':
      $$refreshESM(type, hot, registry);
      break;
    case 'standard':
    case 'webpack5':
      $$refreshStandard(type, hot, registry);
      break;
  }
}
