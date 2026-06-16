'use client';
import { useSetLocale, useLocale, useLocales } from 'gt-next';

export default function LocaleSwitcher() {
  const setLocale = useSetLocale();
  const locale = useLocale();
  const locales = useLocales();

  return (
    <div data-testid='locale-switcher'>
      {locales.map((l) => (
        <button
          key={l}
          data-testid={`switch-${l}`}
          data-active={l === locale}
          onClick={() => setLocale(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
