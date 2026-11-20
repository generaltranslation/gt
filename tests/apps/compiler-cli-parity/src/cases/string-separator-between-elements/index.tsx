export default function StringSeparatorBetweenElements() {
  const items = [
    { position: 1, message: 'Missing value' },
    { position: 2, message: undefined },
  ];
  return (
    <ul>
      {items.map((item) => (
        <li key={item.position}>
          <b>Item {String(item.position)}</b>
          {' — '}
          <span>{item.message ?? 'n/a'}</span>
        </li>
      ))}
    </ul>
  );
}
