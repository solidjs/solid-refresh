import { JSX, createMemo, untrack } from 'solid-js';

export default function createProxy<C extends ((props: P) => JSX.Element), P>(
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
    get(_, property, receiver) {
      return Reflect.get(source(), property, receiver);
    },
    set(_, property, value, receiver) {
      return Reflect.set(source(), property, value, receiver);
    },
  });
}
