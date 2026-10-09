import { createFileRoute } from '@tanstack/react-router';
import { Num, T, useGT } from 'gt-tanstack-start';
import { Crosses } from '../components/Crosses';
import { Footer } from '../components/Footer';

// This route skips server rendering, so its translations resolve in the
// browser from the snapshot the router integration sent down.
export const Route = createFileRoute('/specs')({
  ssr: false,
  component: Specs,
});

function Specs() {
  const gt = useGT();

  const rows = [
    {
      label: gt('Capacity'),
      value: (
        <T>
          <Num>{0.9}</Num> L to the fill line, <Num>{0.25}</Num> L minimum
        </T>
      ),
    },
    {
      label: gt('Body'),
      value: (
        <T>
          304 stainless steel, <Num>{1.1}</Num> mm wall
        </T>
      ),
    },
    {
      label: gt('Heating base'),
      value: (
        <T>
          <Num>{1200}</Num> W at 120 V or 230 V, <Num>{0.75}</Num> m cable
        </T>
      ),
    },
    {
      label: gt('Temperature range'),
      value: (
        <T>
          <Num>{40}</Num> °C to <Num>{100}</Num> °C in <Num>{1}</Num> °C steps
        </T>
      ),
    },
    {
      label: gt('Hold'),
      value: (
        <T>
          Up to <Num>{60}</Num> minutes, then the base switches off
        </T>
      ),
    },
    {
      label: gt('Dimensions'),
      value: (
        <T>
          <Num>{216}</Num> × <Num>{148}</Num> × <Num>{148}</Num> mm
        </T>
      ),
    },
    {
      label: gt('Weight'),
      value: (
        <T>
          <Num>{1.1}</Num> kg kettle, <Num>{0.4}</Num> kg base
        </T>
      ),
    },
  ];

  return (
    <main>
      <section className='gt-row'>
        <div className='section-head'>
          <T>
            <p className='gt-label'>Specifications</p>
            <h1 className='page-title'>Measured on production units.</h1>
            <p className='gt-lead'>
              Each value comes from the last batch of <Num>{500}</Num> kettles.
              This page renders in the browser.
            </p>
          </T>
        </div>
        <Crosses />
      </section>

      <section className='gt-row flush'>
        <dl className='specs'>
          {rows.map((row) => (
            <div className='spec' key={row.label}>
              <dt className='gt-label'>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
        <Crosses />
      </section>

      <div className='gt-hatch' aria-hidden='true' />

      <Footer />
    </main>
  );
}
