import { T, useGT as useLegacyGT } from 'gt-next';
import { msg, useGT, useMessages } from 'gt-next/unstable';

export const registered = msg`Registered message`;

export function Page({ name, count }: { name: string; count: number }) {
  const gt = useGT();
  const alias = gt;
  const save = gt({ context: 'button' });
  const legacyGT = useLegacyGT();
  const m = useMessages();
  const __proto__ = name;
  return (
    <>
      <T>Embedded JSX</T>
      {gt`Embedded string`}
      {gt({ context: 'greeting' })`Hello, ${{ name }}!`}
      {gt`Shared text`}
      {alias`Shared text`}
      {gt`You have ${count} items`}
      {gt`Proto ${{ __proto__ }}`}
      {save`Save`}
      {legacyGT('Legacy string')}
      {m(registered)}
    </>
  );
}

export function Closure() {
  const label = () => gt`Earlier closure`;
  const gt = useGT();
  return label();
}

export function LetBinding() {
  const gt = useGT();
  return gt`Let binding`;
}

export const beforeImport = () => late`Before its import`;

import { t as late } from 'gt-next/unstable';
