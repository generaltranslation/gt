import { Select } from 'gt-react';

export default function BranchManyOptions() {
  return (
    <div>
      <Select value={'size' as string} xs="Extra Small" sm="Small" md="Medium" lg="Large" xl="Extra Large">Default</Select>
    </div>
  );
}
