import { getGT as gTTest } from 'gt-next/server';
import { useGT as gtTestUse } from 'gt-react';

export default async function TestStrings() {
  const tx2 = await gTTest();

  tx2('asyncstring7', { id: 'asyncstring7' });
  tx2('asyncstring8', { context: 'exampleContext' });
  tx2('asyncstring9', { id: 'asyncstring9', context: 'exampleContext' });
}

export function TestStrings2() {
  const tx = gtTestUse();

  tx('string7', { id: 'string7', context: 'exampleContext' });
  tx('string8', { id: 'string8' });
  tx('string9', { context: 'exampleContext' });
}
