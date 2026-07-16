import { getLocales, T, Var } from 'gt-next';
import { getGT, getLocale } from 'gt-next/server';
import { ClientDemo } from './client-demo';

export function generateStaticParams() {
  return getLocales().map((locale: string) => ({ locale }));
}

export default async function Home() {
  const gt = await getGT();
  const locale = await getLocale();
  const renderedAt = new Date().toISOString();

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Next.js App Router</p>
        <h1>gt-next RSC + SSR test</h1>
        <div className='meta'>
          <span>Server locale: {locale}</span>
          <span>Rendered: {renderedAt}</span>
        </div>
      </section>

      <section className='panel'>
        <p className='label'>Server component</p>
        <T>
          <p>
            This paragraph is translated in a React Server Component, with a
            runtime value: <Var>{renderedAt}</Var>
          </p>
        </T>
        <p>{gt('A server-translated string from getGT.')}</p>
      </section>

      <ClientDemo />
    </main>
  );
}
