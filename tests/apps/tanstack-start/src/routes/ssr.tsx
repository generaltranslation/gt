import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { getEnableI18n, getGT, getLocale } from 'gt-tanstack-start/server';
import { ModePanel } from '../components/ModePanel';

const loadSsrData = createServerFn({ method: 'GET' }).handler(async () => {
  const gt = await getGT();
  const locale = getLocale();
  const enableI18n = getEnableI18n();

  return {
    value: `SSR loader ran at ${new Date().toISOString()} for ${locale} (i18n: ${enableI18n})`,
    title: gt('Server rendering | gt-tanstack-start'),
    description: gt(
      'Test gt-tanstack-start with server-rendered loader data and route HTML.'
    ),
  };
});

export const Route = createFileRoute('/ssr')({
  ssr: true,
  loader: () => loadSsrData(),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.title },
      {
        name: 'description',
        content: loaderData?.description,
      },
    ],
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
