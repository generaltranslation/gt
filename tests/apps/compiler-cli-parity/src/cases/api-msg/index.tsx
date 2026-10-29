import { msg, useMessages } from 'gt-react';

const title = msg('Account settings');
const greeting = msg('Hi, {name}', {
  $context: 'informal greeting',
  name: 'Ada',
});
const limited = msg('Upgrade now', { $maxChars: 15 });

export default function ApiMsg() {
  const m = useMessages();
  return (
    <div>
      <h1>{m(title)}</h1>
      <p>{m(greeting)}</p>
      <p>{m(limited)}</p>
    </div>
  );
}
