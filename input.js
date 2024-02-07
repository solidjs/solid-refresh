// Hello

function Example(props) {
  return (
    <h1>
      {props.greeting}, {props.receiver}!
    </h1>
  );
}

function App() {
  return (
    <div>
      <Example />
    </div>
  );
}

const hello = <Example />;
