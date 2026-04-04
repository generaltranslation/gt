import { Var } from 'gt-react';

export default function UserVarOpaque() {
  const name = 'Alice';
  return <div>Hello <Var>{name}</Var></div>;
}
