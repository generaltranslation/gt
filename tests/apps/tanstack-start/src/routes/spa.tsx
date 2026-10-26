import { createFileRoute } from '@tanstack/react-router';
import { ModePanel } from '../components/ModePanel';

export const Route = createFileRoute('/spa')({
  ssr: false,
  // The URL Router gives route context while hydrating, which must match the
  // address bar after GT moves an SPA visitor onto their locale's URL.
  context: ({ location }) => ({ hydratedHref: location.publicHref }),
  loader: ({ context }) => ({
    value: `SPA loader ran at ${new Date().toISOString()}`,
    contextHref: context.hydratedHref,
  }),
  head: () => ({
    meta: [
      { title: 'SPA rendering | gt-tanstack-start' },
      {
        name: 'description',
        content:
          'Test gt-tanstack-start when the route loader and content render in the browser.',
      },
    ],
  }),
  component: SpaRoute,
});

function SpaRoute() {
  const data = Route.useLoaderData();

  return (
    <>
      <ModePanel
        mode='SPA'
        ssrValue='false'
        loaderValue={data.value}
        description='SPA island: the route loader and route component both run on the client for the initial request.'
      />
      <p data-testid='context-href'>{data.contextHref}</p>
    </>
  );
}
