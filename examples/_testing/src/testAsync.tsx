import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import { useGT } from 'gt-react';

export default async function TestStrings() {
  const tx1 = await getGT();
  const tx2 = await getGT();

  tx2('asyncstring1', { id: 'asyncstring1' });
  tx2('asyncstring2', { context: 'exampleContext' });
  tx2('asyncstring3', { id: 'asyncstring3', context: 'exampleContext' });

  tx2('asyncstring4', { id: 'asyncstring4' });
  tx2('asyncstring5', { context: 'exampleContext' });
  tx2('asyncstring6', { id: 'asyncstring6', context: 'exampleContext' });
}
