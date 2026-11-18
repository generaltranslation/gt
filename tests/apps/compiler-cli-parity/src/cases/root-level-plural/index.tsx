import { Plural } from 'gt-react';

export default function RootLevelPlural() {
  const n = 1;
  return (
    <Plural n={n} one={<><strong>one</strong></>}>
      <>other</>
    </Plural>
  );
}
