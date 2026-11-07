import { msg, useGT, useMessages } from 'gt-next';

export const greeting = msg('Registered greeting');

export function Page() {
  const gt = useGT();
  const m = useMessages();
  return (
    <>
      {gt('Inline string')}
      {gt('Shared text')}
      {m('Literal message')}
      {m(greeting)}
      {m(msg('Shared text'))}
    </>
  );
}
