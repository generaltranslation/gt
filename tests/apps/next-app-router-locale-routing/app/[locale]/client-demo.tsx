'use client';

import { LocaleSelector, T, useGT, useLocale } from 'gt-next';

export function ClientDemo() {
  const gt = useGT();
  const locale = useLocale();

  return (
    <section className='panel'>
      <p className='label'>Client component</p>
      <div className='meta'>
        <span>Client locale: {locale}</span>
      </div>
      <LocaleSelector />
      <T>
        <p>This paragraph is translated in a client component.</p>
      </T>
      <p>{gt('A client-translated string from useGT.')}</p>
    </section>
  );
}
