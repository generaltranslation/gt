import type { Example } from '../types';

export const examples: Example[] = [
  {
    name: 'basics/greeting',
    input: 'export const Page = () => <div>Hello {name}!</div>;',
  },
  {
    name: 'basics/no-text',
    input: 'export const Page = () => <div>{name}</div>;',
  },
  {
    name: 'basics/branch',
    input:
      'import { Branch } from "gt-next"; export const Page = () => <main><Branch branch={view} summary={<p>Summary {name}</p>} other={value} /></main>;',
  },
];
