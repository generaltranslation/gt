import { Var } from 'gt-react';

export default function UserVarWithName() {
  const name = 'Alice';
  return <div>Hello <Var name="userName">{name}</Var></div>;
}
