function Card({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return <div>{header}{children}</div>;
}

export default function NonChildrenPropDynamic() {
  const count = 42;
  return (
    <Card header={<h1>Title {count}</h1>}>
      Body text
    </Card>
  );
}
