export default function ChainedLogicalAnd() {
  const show = true;
  const visible = true;
  return (
    <div>
      Hello {show && visible && <span>Content</span>}
    </div>
  );
}
