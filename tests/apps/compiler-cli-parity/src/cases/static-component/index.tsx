import { Static } from 'gt-react';

function getLabel() { return 'label'; }

export default function StaticComponent() {
  return <div>Hello <Static>{getLabel()}</Static></div>;
}
