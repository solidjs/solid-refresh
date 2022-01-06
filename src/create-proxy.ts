import { JSX, createMemo, untrack, $DEVCOMP } from 'solid-js';

interface BaseComponent<P> {
  (props: P): JSX.Element;
}

export default function createProxy<C extends BaseComponent<P>, P>(
  source: () => C,
): (props: P) => JSX.Element {
  return new Proxy(function hmrCompWrapper(props: P, ...rest) {
    const s = source();
    if (!s || $DEVCOMP in s) {
      return createMemo(() => {
        const c = source();
        if (c) {
          return untrack(() => c(props));
        }
        return undefined;
      });
    }
    // no $DEVCOMP means it did not go through devComponent so source() is a regular function, not a component
    return s.call(this, props, ...rest);
  }, {
    get(_, property: keyof C) {
      return source()[property];
    },
    set(_, property: keyof C, value) {
      source()[property] = value;
      return true;
    },
  });
}
