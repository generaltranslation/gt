import { createFileRoute } from '@tanstack/react-router';
import { T, getGT, useGT } from 'gt-tanstack-start';

export const Route = createFileRoute('/data-only')({
  // The loader runs on the server, the component only in the browser
  ssr: 'data-only',
  loader: async () => {
    const t = await getGT();
    return { title: t`Numbers from the server` };
  },
  component: DataOnly,
});

function DataOnly() {
  const { title } = Route.useLoaderData();
  const t = useGT();
  return (
    <main data-page='data-only'>
      <h1 data-m data-src='Numbers from the server'>
        {title}
      </h1>
      <p
        data-m
        data-src='Shown once the page loads'
      >{t`Shown once the page loads`}</p>
      <p data-m data-src='Refreshed every hour'>
        <T>Refreshed every hour</T>
      </p>
    </main>
  );
}
