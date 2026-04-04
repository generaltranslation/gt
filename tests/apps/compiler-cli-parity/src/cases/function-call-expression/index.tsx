export default function FunctionCallExpression() {
  return <div>Result: {getValue()}</div>;
}
function getValue() { return 42; }
