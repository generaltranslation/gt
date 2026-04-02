import { T, Var, Branch, Plural, Derive } from 'gt-react';

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
        <Branch branch="status" active="Active" inactive="Inactive">
          Default
        </Branch>
      </div>
      <div>
        <Plural n={count} one="one item" other="many items" />
      </div>
      <div>
        Label: <Derive>{getLabel()}</Derive>
      </div>
    </div>
  );
}
