import { Branch, T, Var } from 'gt-next';

export default function Page() {
  const access = 'admin';
  const team = 'Platform';

  return (
    <T>
      Access:{' '}
      <Branch
        branch={access}
        admin={
          <strong>
            administrator <Var name='team'>{team}</Var>
          </strong>
        }
        member='member'
      />
    </T>
  );
}
