import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import {
  LocaleSelector,
  Num,
  T,
  getGT,
  msg,
  useGT,
  useLocale,
  useLocales,
  useMessages,
} from 'gt-tanstack-start';
import { getTranslations, useTranslations } from 'gt-tanstack-start/compat';
import { Counter } from '../components/Counter';

const PINNED = msg`Pinned for the week`;

// The first GT code of the payload: it reads the config, and no request state
function Locales() {
  return <p data-locales>{useLocales().join(' ')}</p>;
}

// A server component that reads its translations with hooks
function Footnote() {
  const t = useGT();
  const m = useMessages();
  const d = useTranslations('glossary');
  return (
    <footer>
      <p data-m data-src='Checked by the hook'>{t`Checked by the hook`}</p>
      <p data-m data-src='Pinned for the week'>
        {m(PINNED)}
      </p>
      <p data-m data-src='Words from the dictionary'>
        {d('title')}
      </p>
      <p data-locale>{useLocale()}</p>
    </footer>
  );
}

// A server component: rendered on the server only, and sent as a payload
// that names the client components it renders
async function Board() {
  const t = await getGT();
  const d = await getTranslations('glossary');
  return (
    <section data-component='board'>
      <p data-m data-src='Posted by the server'>{t`Posted by the server`}</p>
      <p data-m data-src='Kept on the notice board'>
        <T>Kept on the notice board</T>
      </p>
      <p data-m data-src='There are 4 notices today'>
        <T>
          There are <Num>{4}</Num> notices today
        </T>
      </p>
      <p data-m data-src='Found by its key'>
        {d('note')}
      </p>
      <Footnote />
      <LocaleSelector />
      <Counter />
    </section>
  );
}

const getBoard = createServerFn().handler(async () => ({
  Board: await renderServerComponent(
    <>
      <Locales />
      <Board />
    </>
  ),
}));

export const Route = createFileRoute('/panel')({
  loader: () => getBoard(),
  component: Panel,
});

function Panel() {
  const { Board } = Route.useLoaderData();
  const t = useGT();
  return (
    <main data-page='panel'>
      <h1 data-m data-src='Today on the board'>{t`Today on the board`}</h1>
      {Board}
    </main>
  );
}
