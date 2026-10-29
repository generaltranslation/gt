import { T, Var, Num } from 'gt-react';

export default function ApiTNestedVars({
  name = 'Ada',
  count = 3,
}: {
  name?: string;
  count?: number;
}) {
  return (
    <T>
      Hello{' '}
      <b>
        <Var>{name}</Var>
      </b>
      , you have <Num>{count}</Num> new{' '}
      <a href="/inbox">
        <em>messages</em>
      </a>
      .
    </T>
  );
}
