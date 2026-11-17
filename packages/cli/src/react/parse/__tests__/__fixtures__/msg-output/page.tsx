'use client';
import { T } from 'gt-next';
import { useGT, useMessages } from 'gt-next/unstable';
import { menu, welcome } from './messages';

export function Page() {
  const gt = useGT();
  const m = useMessages();
  return (
    <>
      <T>Page body</T>
      {gt`Welcome back`}
      {gt`Page title`}
      {m(welcome)}
      {m(menu)}
    </>
  );
}
