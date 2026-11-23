import { Suspense, lazy, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { T, getGT, useGT, useMessages } from 'gt-tanstack-start';
import { Summary } from '../components/Summary';
import { STATUSES } from '../components/statuses';

const Dialog = lazy(() =>
  import('../components/Dialog').then((module) => ({ default: module.Dialog }))
);

export const Route = createFileRoute('/reports')({
  // Runs on the server for a first visit and in the browser on navigation
  loader: async () => {
    const t = await getGT();
    return { title: t`Reports overview` };
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title }] }),
  component: Reports,
});

function Reports() {
  const { title } = Route.useLoaderData();
  const t = useGT();
  const m = useMessages();
  const [open, setOpen] = useState(false);
  return (
    <main data-page='reports'>
      <h1 data-m data-src='Reports overview'>
        {title}
      </h1>
      <p
        data-m
        data-src='Open the weekly report'
      >{t`Open the weekly report`}</p>
      <p data-m data-src='Shared with your team'>
        <T>Shared with your team</T>
      </p>
      <ul>
        {STATUSES.map((status) => (
          <li key={status.source} data-m data-src={status.source}>
            {m(status.message)}
          </li>
        ))}
      </ul>
      <Summary />
      <button data-open-dialog onClick={() => setOpen(true)}>
        +
      </button>
      {open && (
        <Suspense fallback={null}>
          <Dialog />
        </Suspense>
      )}
    </main>
  );
}
