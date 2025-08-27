import { T, Branch } from 'gt-next';

export default function Page() {
  const status = 'active';
  
  return (
    <T>
      <Branch branch={status}
        active="The user is active"
        inactive="The user is inactive"
      />
    </T>
  );
}