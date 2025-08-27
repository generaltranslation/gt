'use client';

import { msg, useMessages } from 'gt-next';

const encodedGreeting = msg('Hello, World!');

export default function Page() {
  const m = useMessages();

  return <>{m(encodedGreeting)}</>;
}
