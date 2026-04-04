export default function DoubleTernary() {
  const a = true;
  const b = false;
  return (
    <div>
      First: {a ? <span>Yes</span> : <span>No</span>}
      Second: {b ? <em>On</em> : <em>Off</em>}
    </div>
  );
}
