'use client';

import { LocaleSelector, useLocale } from 'gt-next';
import { useState } from 'react';
import { getContent } from './content';

export function ClientPanel() {
  const locale = useLocale();
  const [clientStateMarker, setClientStateMarker] = useState('');

  return (
    <section>
      <h2>Client component</h2>
      <p>Client locale: {locale}</p>
      <p>Client content: {getContent(locale)}</p>
      <label>
        Client state marker
        <input
          value={clientStateMarker}
          onChange={(event) => setClientStateMarker(event.currentTarget.value)}
        />
      </label>
      <LocaleSelector />
    </section>
  );
}
