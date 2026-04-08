export default function LogicalAnd() {
  const show = true;
  return (
    <div>
      Hello {show && <span>Content</span>}
    </div>
  );
}
