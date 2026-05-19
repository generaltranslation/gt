import { Derive } from 'gt-react';

function getLabel() { return 'label'; }

export default function StaticComponent() {
  return <div>Hello <Derive>{getLabel()}</Derive></div>;
}
