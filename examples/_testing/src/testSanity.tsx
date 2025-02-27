import { getGT as gTTest } from 'gt-next/server';
import { useGT as gtTestUse, useGT } from 'gt-react';
import { getGT } from 'gt-next/server';

export default async function TestStrings() {
  const tx = await getGT();
  const tx2 = await gTTest();

  tx2('asyncstring10', { id: 'asyncstring10' });
  tx2('asyncstring11', { context: 'exampleContext' });
  tx2('asyncstring12', { id: 'asyncstring12', context: 'exampleContext' });

  tx('asyncstring13', { id: 'asyncstring13' });
  tx('asyncstring14', { context: 'exampleContext' });
  tx('asyncstring15', { id: 'asyncstring15', context: 'exampleContext' });
}

export function TestStrings2() {
  const tx2 = useGT();
  const tx = gtTestUse();

  tx('string10', { id: 'string10', context: 'exampleContext' });
  tx('string11', { id: 'string11' });
  tx('string12', { context: 'exampleContext' });

  tx2('string13', { id: 'string13' });
  tx2('string14', { context: 'exampleContext' });
  tx2('string15', { id: 'string15', context: 'exampleContext' });
}
