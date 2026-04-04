export default function SpreadInSibling() {
  const x = 'dynamic';
  return (
    <div>
      <p>Static text</p>
      <p>Dynamic {x} text</p>
    </div>
  );
}
