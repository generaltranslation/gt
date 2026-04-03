export default function MapIterator() {
  const items = [{ name: 'A' }, { name: 'B' }];
  return (
    <ul>
      Items: {items.map((i) => <li key={i.name}>{i.name}</li>)}
    </ul>
  );
}
