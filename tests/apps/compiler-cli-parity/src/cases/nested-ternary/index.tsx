export default function NestedTernary() {
  const a = true;
  const b = false;
  return (
    <div>
      Result: {a ? (b ? <span>A+B</span> : <span>A-B</span>) : <span>C</span>}
    </div>
  );
}
