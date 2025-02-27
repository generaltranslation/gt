import { useGT } from 'gt-react';

export default function TestStrings() {
  const tx = useGT();

  const tx2 = useGT();

  tx('string1', { id: 'string1', context: 'exampleContext' });
  tx('string2', { id: 'string2' });
  tx('string3', { context: 'exampleContext' });

  tx2('string4', { id: 'string4' });
  tx2('string5', { context: 'exampleContext' });
  tx2('string6', { id: 'string6', context: 'exampleContext' });

  tx2(`templateString`, { id: 'templateString', context: 'exampleContext' });
  tx2(`templateStr${'a'}ing`, {
    id: 'templateString2',
    context: 'exampleContext',
  });
}
