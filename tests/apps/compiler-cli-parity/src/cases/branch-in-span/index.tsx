import { Branch } from 'gt-react';

export default function BranchInSpan() {
  return <span>Status: <Branch branch="x" on="On" off="Off">Unknown</Branch></span>;
}
