import { createFileRoute } from '@tanstack/react-router';
import { ModePanel } from '../components/ModePanel';

export const Route = createFileRoute('/ssr')({
  ssr: true,
  loader: () => ({
    value: `SSR loader ran at ${new Date().toISOString()}`,
  }),
  component: SSRRoute,
});

function SSRRoute() {
  const data = Route.useLoaderData();

  return (
    <ModePanel
      mode='SSR'
      ssrValue='true'
      loaderValue={data.value}
      description='Full SSR: loader data and route HTML are produced on the server for the initial request.'
    />
  );
}
