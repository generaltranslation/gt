import { Suspense } from 'react';
import { Await, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { T, getGT, useGT } from 'gt-tanstack-start';

// Runs on the server only, so its message is no message of the browser
const getServerNote = createServerFn().handler(async () => {
  const t = await getGT();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { text: t`Written on the server`, source: 'Written on the server' };
});

export const Route = createFileRoute('/deferred')({
  // Not awaited: the page streams and this part arrives later
  loader: () => ({ note: getServerNote() }),
  component: Deferred,
});

function Note({ note }: { note: { text: string; source: string } }) {
  const t = useGT();
  return (
    <div data-deferred>
      <p data-m data-src={note.source}>
        {note.text}
      </p>
      <p
        data-m
        data-src='Arrived after the page'
      >{t`Arrived after the page`}</p>
      <p data-m data-src='Thanks for waiting'>
        <T>Thanks for waiting</T>
      </p>
    </div>
  );
}

function Deferred() {
  const { note } = Route.useLoaderData();
  const t = useGT();
  return (
    <main data-page='deferred'>
      <h1
        data-m
        data-src='Still loading the rest'
      >{t`Still loading the rest`}</h1>
      <Suspense fallback={<p data-fallback>...</p>}>
        <Await promise={note}>{(resolved) => <Note note={resolved} />}</Await>
      </Suspense>
    </main>
  );
}
