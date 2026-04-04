import { Var, Derive } from 'gt-react';

function getItem() {
  return 'widget';
}

export default function MixedGtComponents() {
  const price = 9.99;
  return (
    <div>
      Price: <Var>{price}</Var> for <Derive>{getItem()}</Derive>
    </div>
  );
}
