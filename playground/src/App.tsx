import { createSignal, onCleanup, onMount } from 'solid-js';

export function App() {
  const [count, setCount] = createSignal(0);

  function increment() {
    setCount(c => c + 1);
  }

  function decrement() {
    setCount(c => c - 1);
  }
  onMount(() => {
    console.log('Mounted App');
  });
  onCleanup(() => {
    console.log('Unmounted App');
  });

  return (
    <>
      <h1>Count: {count()}</h1>
      <button type="button" onClick={increment}>
        Increment
      </button>
      <button type="button" onClick={decrement}>
        Decrement
      </button>
    </>
  );
}
