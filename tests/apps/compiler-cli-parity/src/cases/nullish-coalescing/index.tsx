export default function NullishCoalescing() {
  const name = null;
  return <div>Name: {name ?? "Anonymous"}</div>;
}
