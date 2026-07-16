import { Suspense } from 'react';
import { getLocales, T, Var } from 'gt-next';
import { getGT, getLocale } from 'gt-next/server';
import { cacheLife, cacheTag } from 'next/cache';
import { ClientDemo } from './client-demo';

export function generateStaticParams() {
  return getLocales().map((locale: string) => ({ locale }));
}

async function CachedServerPanel({ locale }: { locale: string }) {
  'use cache';

  cacheLife('minutes');
  cacheTag(`gt-cache-server-panel-${locale}`);

  const gt = await getGT();

  return (
    <section className='panel'>
      <p className='label'>Cached server component</p>
      <T>
        <p>
          This paragraph is translated in a cached React Server Component, with
          a cached locale value: <Var>{locale}</Var>
        </p>
      </T>
      <p>{gt('A server-translated string from a cached component.')}</p>
    </section>
  );
}

async function CachedLocalePanel({ locale }: { locale: string }) {
  'use cache';

  cacheLife('hours');
  cacheTag(`gt-cache-locale-panel-${locale}`);

  return (
    <section className='panel'>
      <p className='label'>Cached locale component</p>
      <T>
        <p>
          This cached component receives the locale as a serializable prop:{' '}
          <Var>{locale}</Var>
        </p>
      </T>
    </section>
  );
}

export default async function Home() {
  const locale = await getLocale();

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Next.js App Router Cache Components</p>
        <h1>gt-next cache components locale-routing test</h1>
        <div className='meta'>
          <span>Server locale: {locale}</span>
        </div>
      </section>

      <Suspense
        fallback={<section className='panel'>Loading cache test...</section>}
      >
        <CachedServerPanel locale={locale} />
      </Suspense>

      <Suspense
        fallback={<section className='panel'>Loading locale cache...</section>}
      >
        <CachedLocalePanel locale={locale} />
      </Suspense>

      <ClientDemo />
    </main>
  );
}
