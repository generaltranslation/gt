export default function TemplateLiteralDynamic() {
  const name = 'Alice';
  return <div>Greeting: {`Hello ${name}`}</div>;
}
