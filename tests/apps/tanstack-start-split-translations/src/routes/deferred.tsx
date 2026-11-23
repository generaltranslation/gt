import { Suspense } from 'react';
import { Await, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { T, getGT, msg, useGT, useMessages } from 'gt-tanstack-start';

// Runs on the server only, so the build of the browser's code never sees its
// messages. The first two it translates itself. The next two it sends as
// messages, which the browser translates, so both travel with every page:
// one that no chunk of the browser reads, and one whose text the home page,
// a chunk this page does not load, also has in a t template.
const getServerNote = createServerFn().handler(async () => {
  const t = await getGT();
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    text: t`Written on the server`,
    source: 'Written on the server',
    status: t`Waiting for review`,
    notice: msg('Checked by the server'),
    // From the server too, so no chunk of the browser holds the text
    noticeSource: 'Checked by the server',
    shared: msg('Welcome back'),
    sharedSource: 'Welcome back',
  };
});

export const Route = createFileRoute('/deferred')({
  // Not awaited: the page streams and this part arrives later
  loader: () => ({ note: getServerNote() }),
  component: Deferred,
});

function Note({
  note,
}: {
  note: {
    text: string;
    source: string;
    status: string;
    notice: string;
    noticeSource: string;
    shared: string;
    sharedSource: string;
  };
}) {
  const t = useGT();
  const m = useMessages();
  return (
    <div data-deferred>
      <p data-m data-notice data-src={note.noticeSource}>
        {m(note.notice)}
      </p>
      <p data-m data-shared data-src={note.sharedSource}>
        {m(note.shared)}
      </p>
      <p data-m data-src={note.source}>
        {note.text}
      </p>
      <p data-m data-src='Waiting for review'>
        {note.status}
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
