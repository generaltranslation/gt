export default function ElementInBraces() {
  const show = true;
  const name = 'Ada';
  const items = [{ id: 1 }, { id: 2 }];
  return (
    <div>
      <p>Lead {<b>Bold words</b>}</p>
      <p>{' · '}{<b>Strong words</b>}</p>
      <>Within a fragment {<i>italic words</i>}</>
      <p>{show && <>{' ‣ '}{<em>Shown words</em>}</>}</p>
      <ul>{items.map((item) => <li key={item.id}>Row {<b>listed words</b>}</li>)}</ul>
      <p>Signed in as {<b>{name}</b>}</p>
      <p>Opening {<>fragment words <b>bolder words</b></>}</p>
    </div>
  );
}
