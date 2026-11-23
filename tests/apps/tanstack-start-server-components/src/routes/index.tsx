import { createFileRoute } from '@tanstack/react-router';
import { useGT } from 'gt-tanstack-start';

export const Route = createFileRoute('/')({
  component: Start,
});

function Start() {
  const t = useGT();
  return (
    <main data-page='start'>
      <h1 data-m data-src='Nothing from the server here'>
        {t`Nothing from the server here`}
      </h1>
    </main>
  );
}
