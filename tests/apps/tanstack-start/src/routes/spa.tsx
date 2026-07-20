import { createFileRoute } from '@tanstack/react-router';
import { ModePanel } from '../components/ModePanel';

export const Route = createFileRoute('/spa')({
  ssr: false,
  loader: () => ({
    value: `SPA loader ran at ${new Date().toISOString()}`,
  }),
  component: SpaRoute,
});

function SpaRoute() {
  const data = Route.useLoaderData();

  return (
    <ModePanel
      mode='SPA'
      ssrValue='false'
      loaderValue={data.value}
      description='SPA island: the route loader and route component both run on the client for the initial request.'
    />
  );
}
