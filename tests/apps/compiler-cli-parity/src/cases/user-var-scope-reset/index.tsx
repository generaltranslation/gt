import { Var } from 'gt-react';

export default function UserVarScopeReset() {
  const x = 'dynamic';
  return (
    <div>
      <Var>{<p>Opaque</p>}</Var>
      <span>Auto {x}</span>
    </div>
  );
}
