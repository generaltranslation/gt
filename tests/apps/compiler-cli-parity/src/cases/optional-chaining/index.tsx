export default function OptionalChaining() {
  const user = { name: 'Alice' };
  return <div>Name: {user?.name}</div>;
}
