function Card({ header, footer, children }: any) {
  return <div>{header}{children}{footer}</div>;
}

export default function CardHeaderFooterDynamic() {
  const name = 'Alice';
  const date = '2024-01-01';
  return (
    <Card
      header={<h2>Welcome {name}</h2>}
      footer={<small>Updated {date}</small>}
    >
      Main content here
    </Card>
  );
}
