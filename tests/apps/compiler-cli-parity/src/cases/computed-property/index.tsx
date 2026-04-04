export default function ComputedProperty() {
  const obj = { key: 'value' };
  const k = 'key';
  return <div>Value: {obj[k]}</div>;
}
