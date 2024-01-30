// Hello

function Example(props) {
  return (
    <h1>
      {props.greeting}, {props.receiver}!
    </h1>
  );
}

const hello = <Example />;
