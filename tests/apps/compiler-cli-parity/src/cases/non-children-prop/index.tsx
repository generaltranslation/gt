function Card({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return <div>{header}{children}</div>;
}

export default function NonChildrenProp() {
  return (
    <Card header={<h1>Title</h1>}>
      Body text
    </Card>
  );
}
