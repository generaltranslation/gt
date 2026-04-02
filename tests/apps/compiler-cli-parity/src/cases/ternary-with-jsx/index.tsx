export default function TernaryWithJsx() {
  const flag = true;
  return (
    <div>
      Status: {flag ? <span>Active</span> : <span>Inactive</span>}
    </div>
  );
}
