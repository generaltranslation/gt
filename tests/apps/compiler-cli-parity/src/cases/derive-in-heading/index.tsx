import { Derive } from 'gt-react';

function getTitle() {
  return 'Dynamic Title';
}

export default function DeriveInHeading() {
  return <h2>Label: <Derive>{getTitle()}</Derive></h2>;
}
