export default function SiblingsMixedTextAndDynamic() {
  const x = 'X';
  return (
    <div>
      <p>Static only</p>
      <p>{x}</p>
      <p>Text with {x}</p>
      <p />
    </div>
  );
}
