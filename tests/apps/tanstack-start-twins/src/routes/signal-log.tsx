import { createFileRoute } from '@tanstack/react-router';
import { T, Var, useGT } from 'gt-tanstack-start/experimental';

// Never server-rendered: the browser renders it from the locale's twins.
export const Route = createFileRoute('/signal-log')({
  ssr: false,
  component: SignalLogPage,
});

const keeperName = 'Grace';

function SignalLogPage() {
  const gt = useGT();

  return (
    <section className='panel' data-testid='signal-log-page'>
      <T>
        <h2>Signal log of the night watch</h2>
        <p>
          Entries are written by <Var>{keeperName}</Var> after every lantern
          check.
        </p>
      </T>
      <p data-testid='signal-gt'>
        {gt('Three short flashes mean the channel is clear.')}
      </p>
    </section>
  );
}
