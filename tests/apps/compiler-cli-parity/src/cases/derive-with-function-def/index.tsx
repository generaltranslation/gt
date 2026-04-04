import { Derive } from 'gt-react';

function Card({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return <div>{header}{children}</div>;
}

export default function DeriveWithFunctionDef() {
  const name = 'Alice';
  return (
    <div>
      Hello <Derive>
        <Card header={<h2>Welcome {name}</h2>}>
          Body text
        </Card>
      </Derive>
    </div>
  );
}
