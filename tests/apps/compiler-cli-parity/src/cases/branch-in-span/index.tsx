import { Select } from 'gt-react';

export default function BranchInSpan() {
  return <span>Status: <Select value={'x' as string} on="On" off="Off">Unknown</Select></span>;
}
