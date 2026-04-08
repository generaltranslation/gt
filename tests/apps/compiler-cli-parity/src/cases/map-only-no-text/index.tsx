export default function MapOnlyNoText() {
  const items = [{ name: 'A' }, { name: 'B' }];
  return (
    <ul>
      {items.map((i) => <li key={i.name}>{i.name}</li>)}
    </ul>
  );
}
