import { createFileRoute } from '@tanstack/react-router';
import { T, useGT } from 'gt-tanstack-start';

export const Route = createFileRoute('/client-only')({
  // Neither the loader nor the component runs on the server
  ssr: false,
  component: ClientOnly,
});

function ClientOnly() {
  const t = useGT();
  return (
    <main data-page='client-only'>
      <h1
        data-m
        data-src='Drawn in your browser'
      >{t`Drawn in your browser`}</h1>
      <p data-m data-src='Nothing here came from the server'>
        <T>Nothing here came from the server</T>
      </p>
    </main>
  );
}
