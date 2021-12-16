import { JSX, createMemo, untrack } from 'solid-js';

interface BaseComponent<P> {
  (props: P): JSX.Element;
}

export default function createProxy<C extends BaseComponent<P>, P>(
  source: () => C,
): (props: P) => JSX.Element {
  return new Proxy((props: P) => (
    createMemo(() => {
      const c = source();
      if (c) {
        return untrack(() => c(props));
      }
      return undefined;
    })
  ), {
    get(_, property: keyof C) {
      return source()[property];
    },
    set(_, property: keyof C, value) {
      source()[property] = value;
      return true;
    },
  });
}
