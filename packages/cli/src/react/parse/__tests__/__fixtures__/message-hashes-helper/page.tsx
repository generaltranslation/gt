import { useGT, useMessages } from 'gt-next';
import { getLabel } from './helpers';

export function Page() {
  const gt = useGT();
  const m = useMessages();
  return (
    <>
      {getLabel(gt)}
      {getLabel(m)}
    </>
  );
}
