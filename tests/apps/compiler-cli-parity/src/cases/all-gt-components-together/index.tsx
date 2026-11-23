import { T, Var, Select, Plural, Derive } from 'gt-react';

function getLabel() {
  return 'derived';
}

export default function AllGtComponentsTogether() {
  const name = 'Alice';
  const count = 3;
  return (
    <div>
      <T>Manual translation</T>
      <p>Auto text with <Var>{name}</Var></p>
      <div>
        <Select value={'status' as string} active="Active" inactive="Inactive">Default</Select>
      </div>
      <div>
        <Plural n={count} one="one item">many items</Plural>
      </div>
      <div>
        Label: <Derive>{getLabel()}</Derive>
      </div>
    </div>
  );
}
