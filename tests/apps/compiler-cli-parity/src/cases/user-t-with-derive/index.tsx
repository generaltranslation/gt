import { T, Derive } from 'gt-react';

function getName() {
  return 'Alice';
}

export default function UserTWithDerive() {
  return (
    <T>
      Hello <Derive>{getName()}</Derive>
    </T>
  );
}
