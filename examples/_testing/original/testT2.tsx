export default function Home() {
  const temp = 'Hello World!';

  const test1 = <div>Hello World!</div>;
  const test2 = <p>Hello World!</p>;
  const test3 = <p>{true && 'true'}</p>;
  const test4 = <div>{test2}</div>;
  const test5 = <div>{true ? 'true' : 'false'}</div>;
  const test6 = <div>{true ? <div>true</div> : <div>{temp}</div>}</div>;
  return (
    <div>
      <p>Hello World!</p>
      <p>{'Hello World!'}</p>
      <p>{'Hello,' + ' World!'}</p>
      <div>
        <p>Hello World!</p>
      </div>
      <p>{3 + 3}</p>
      <p>{3 + '3'}</p>
      <p>{3}</p>
      <p>{`${3}`}</p>
      <p>{`${temp}`}</p>
      <p>{`${temp}` + 3}</p>
      <p>{`3`}</p>
      <p>{`3` + 3}</p>
      <p>{true && 'true'}</p>
      <p>{true || 'true'}</p>
      <p>{true ? 'true' : 'false'}</p>
      <p>{true ? (true ? 'true' : 'false') : 'false'}</p>
      <p>{true ? (true ? 'true' : 'false') : true ? 'true' : 'false'}</p>
      <p>{true && <p>true</p>}</p>
      <p>{true || <p>true</p>}</p>
      <p>{true ? <p>true</p> : <p>false</p>}</p>
      <p>{true ? true ? <p>true</p> : <p>false</p> : <p>false</p>}</p>
      <p>
        {true ? (
          true ? (
            <p>true</p>
          ) : (
            <p>false</p>
          )
        ) : true ? (
          <p>true</p>
        ) : (
          <p>false</p>
        )}
      </p>
      <p>{'hello' || 'true'}</p>
      <p>{'hello' ?? 'true'}</p>
      <p>{'hello' && 'true'}</p>
      <p>{'hello' && 'true'}</p>
      <p>{'hello' && 'true'}</p>
    </div>
  );
}
