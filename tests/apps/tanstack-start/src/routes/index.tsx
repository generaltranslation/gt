import { createFileRoute } from '@tanstack/react-router';
import { T } from 'gt-tanstack-start';

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'Rendering modes | gt-tanstack-start' },
      {
        name: 'description',
        content:
          'Compare gt-tanstack-start behavior across SSR, SPA, and data-only rendering modes.',
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Purpose</p>
        <h1>TanStack Start rendering mode checks</h1>
        <T>
          <p className='note'>
            One GTProvider at the root; each route exercises a different
            TanStack Start rendering behavior.
          </p>
        </T>
      </section>

      <section className='grid'>
        <div className='panel'>
          <p className='label'>SSR</p>
          <p className='note'>
            Loader and component render on the server for the initial request (
            <span className='code'>ssr: true</span>).
          </p>
        </div>
        <div className='panel'>
          <p className='label'>SPA</p>
          <p className='note'>
            The route opts out of server rendering entirely with{' '}
            <span className='code'>ssr: false</span> — loader and component run
            on the client.
          </p>
        </div>
        <div className='panel'>
          <p className='label'>Data only</p>
          <p className='note'>
            The loader runs on the server, but the component renders on the
            client (<span className='code'>ssr: 'data-only'</span>).
          </p>
        </div>
      </section>

      <section className='panel'>
        <p className='label'>Note</p>
        <p className='note'>
          TanStack Start has no stable RSC mode yet — the next-app-router app in
          this repo is the RSC test bed.
        </p>
      </section>
    </main>
  );
}
