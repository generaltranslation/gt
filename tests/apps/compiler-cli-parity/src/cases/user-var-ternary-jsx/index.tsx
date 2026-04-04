import { Var } from 'gt-react';

export default function UserVarTernaryJsx() {
  const flag = true;
  return (
    <div>
      Hello <Var>{flag ? <p>A</p> : <p>B</p>}</Var>
    </div>
  );
}
