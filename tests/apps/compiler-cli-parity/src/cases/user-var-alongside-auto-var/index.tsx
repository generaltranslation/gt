import { Var } from 'gt-react';

export default function UserVarAlongsideAutoVar() {
  const a = 'Alice';
  const b = 'Bob';
  return <div>Hello <Var>{a}</Var> and {b}</div>;
}
