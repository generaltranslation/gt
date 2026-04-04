export default function TernaryNullBranch() {
  const show = true;
  return <div>Hello {show ? <b>World</b> : null}</div>;
}
