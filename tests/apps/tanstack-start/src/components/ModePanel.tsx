import { T, useGT, useLocale } from 'gt-tanstack-start';

type ModePanelProps = {
  mode: string;
  ssrValue: string;
  loaderValue?: string;
  description: string;
};

export function ModePanel({
  mode,
  ssrValue,
  loaderValue,
  description,
}: ModePanelProps) {
  const gt = useGT();
  const locale = useLocale();

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Rendering mode</p>
        <h1>{mode}</h1>
        <p className='note'>{description}</p>
      </section>

      <section className='grid'>
        <div className='panel'>
          <p className='label'>Route config</p>
          <p className='value'>
            <span className='code'>ssr: {ssrValue}</span>
          </p>
        </div>
        <div className='panel'>
          <p className='label'>Provider locale</p>
          <p className='value'>{locale}</p>
        </div>
        <div className='panel'>
          <p className='label'>Loader data</p>
          <p className='value'>{loaderValue ?? 'No loader data'}</p>
        </div>
      </section>

      <section className='panel'>
        <p className='label'>GT smoke test</p>
        <p>
          <T>Hello from the root provider.</T>
        </p>
        <p>{gt('A runtime gt() string call.')}</p>
      </section>
    </main>
  );
}
