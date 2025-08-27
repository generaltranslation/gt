import { getMessages } from 'gt-next/server';
import { msg } from 'gt-next';

const encodedGreeting = msg('Hello, World!');

export default async function Page() {
  const m = await getMessages();

  return <>{m(encodedGreeting)}</>;
}
