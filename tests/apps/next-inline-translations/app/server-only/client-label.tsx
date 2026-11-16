'use client';

import { useMessages } from 'gt-next';

export function ClientLabel({ message }: { message: string }) {
  const m = useMessages();
  return <p data-testid='server-greeting'>{m(message)}</p>;
}
