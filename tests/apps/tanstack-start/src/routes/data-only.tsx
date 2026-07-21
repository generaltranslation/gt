import { createFileRoute } from '@tanstack/react-router';
import { ModePanel } from '../components/ModePanel';

export const Route = createFileRoute('/data-only')({
  ssr: 'data-only',
  loader: () => ({
    value: `Data-only loader ran at ${new Date().toISOString()}`,
  }),
  head: () => ({
    meta: [
      { title: 'Data-only rendering | gt-tanstack-start' },
      {
        name: 'description',
        content:
          'Test gt-tanstack-start with server-loaded data and client-rendered route content.',
      },
    ],
  }),
  component: DataOnlyRoute,
});

function DataOnlyRoute() {
  const data = Route.useLoaderData();

  return (
    <ModePanel
      mode='Data only'
      ssrValue="'data-only'"
      loaderValue={data.value}
      description='The loader runs on the server for the initial request, but the route component renders on the client.'
    />
  );
}
