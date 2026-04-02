export default function TernaryNoText() {
  const flag = true;
  return (
    <div>
      {flag ? <p>Yes</p> : <p>No</p>}
    </div>
  );
}
