import { msg } from 'gt-tanstack-start';

// Messages the build cannot place with a chunk
export const STATUSES = [
  { source: 'Waiting for review', message: msg`Waiting for review` },
  { source: 'Approved by the team', message: msg`Approved by the team` },
];
