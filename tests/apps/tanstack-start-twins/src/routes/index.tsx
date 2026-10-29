import { createFileRoute } from '@tanstack/react-router';
import {
  Derive,
  Num,
  Plural,
  T,
  Var,
  msg,
  t,
  useGT,
  useMessages,
} from 'gt-tanstack-start';
import { SharedFooter } from '../components/SharedFooter';

// Server-rendered (the default), then hydrated from the locale's twins.
export const Route = createFileRoute('/')({
  component: HomePage,
});

// A module-level msg() attaches to this module; rendered with useMessages().
const tagline = msg('Maps drawn by hand and verified by sailors.');

const visitorName = 'Ada';
const shipCount = 3;

function getSeason() {
  return 'Storm watch season';
}

function HomePage() {
  const gt = useGT();
  const m = useMessages();

  return (
    <section className='panel' data-testid='home-page'>
      <T>
        <p>
          Welcome aboard, <Var>{visitorName}</Var>. The atlas charts{' '}
          <b>
            <Num>{1234}</Num> coastal islands
          </b>{' '}
          and every <i>lighthouse keeper</i> who tends them.
        </p>
      </T>
      <p data-testid='home-gt'>
        {gt('Tide tables refresh every morning at dawn.')}
      </p>
      <p data-testid='home-gt-vars'>
        {gt('Your lantern is lit, {name}.', { name: visitorName })}
      </p>
      <p data-testid='home-msg'>{m(tagline)}</p>
      <p data-testid='home-t'>{t('Fog warnings are posted at the pier.')}</p>
      <T>
        <Plural
          n={shipCount}
          one={<p>One fishing boat is moored tonight.</p>}
          other={<p>Several fishing boats are moored tonight.</p>}
        />
      </T>
      {/* Unattributed control: derived content is hashed at runtime, so its
          source text stays in code and renders untranslated. */}
      <p data-testid='home-unattributed'>
        <T>
          Current notice: <Derive>{getSeason()}</Derive>
        </T>
      </p>
      <SharedFooter />
    </section>
  );
}
