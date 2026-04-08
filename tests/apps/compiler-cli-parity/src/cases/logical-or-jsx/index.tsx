export default function LogicalOrJsx() {
  const val = null;
  return (
    <div>
      Value: {val || <span>Default</span>}
    </div>
  );
}
