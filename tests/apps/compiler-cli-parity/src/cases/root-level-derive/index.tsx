import { Derive } from 'gt-react';

function getLabel() {
  return 'label';
}

export default function RootLevelDerive() {
  return <Derive>{getLabel()}</Derive>;
}
