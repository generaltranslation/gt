export default function NullishWithJsx() {
  const content = null;
  return <div>Content: {content ?? <span>Default</span>}</div>;
}
