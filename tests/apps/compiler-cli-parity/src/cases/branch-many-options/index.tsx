import { Branch } from 'gt-react';

export default function BranchManyOptions() {
  return (
    <div>
      <Branch branch={'size' as string} xs="Extra Small" sm="Small" md="Medium" lg="Large" xl="Extra Large" other="Default" />
    </div>
  );
}
