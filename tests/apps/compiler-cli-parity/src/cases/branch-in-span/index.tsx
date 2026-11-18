import { Branch } from 'gt-react';

export default function BranchInSpan() {
  return <span>Status: <Branch branch={'x' as string} on="On" off="Off">Unknown</Branch></span>;
}
