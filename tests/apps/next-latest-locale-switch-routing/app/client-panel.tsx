'use client';

import { LocaleSelector, useLocale } from 'gt-next';
import { getContent } from './content';

export function ClientPanel() {
  const locale = useLocale();

  return (
    <section>
      <h2>Client component</h2>
      <p>Client locale: {locale}</p>
      <p>Client content: {getContent(locale)}</p>
      <LocaleSelector />
    </section>
  );
}
