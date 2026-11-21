import { T, Select } from 'gt-next';

export default function Page() {
  const status = 'active' as 'active' | 'inactive';

  return (
    <T>
      <Select
        value={status}
        active='The user is active'
        inactive='The user is inactive'
      />
    </T>
  );
}
