import { Derive } from 'gt-react';

function getX() {
  return 'derived';
}

export default function DeriveAlongsideDynamic() {
  const z = 'regular';
  return (
    <div>
      Hello <Derive>{getX()}</Derive> and {z}
    </div>
  );
}
