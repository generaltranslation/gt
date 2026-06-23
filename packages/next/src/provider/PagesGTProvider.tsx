'use client';

import { GTProvider as ReactGTProvider } from 'gt-react/context';
import { initializeGTNextContext } from '../config-dir/initializeGTNextContext';

type ReactGTProviderProps = Parameters<typeof ReactGTProvider>[0];
type PagesGTProviderProps = Omit<
  ReactGTProviderProps,
  'locale' | 'translations'
> &
  Partial<Pick<ReactGTProviderProps, 'locale' | 'translations'>>;

export function PagesGTProvider({
  locale,
  translations,
  ...props
}: PagesGTProviderProps) {
  const config = initializeGTNextContext();
  const resolvedLocale = locale ?? config.getDefaultLocale();
  const translationsLocale = Array.isArray(resolvedLocale)
    ? (resolvedLocale[0] ?? config.getDefaultLocale())
    : resolvedLocale;
  return (
    <ReactGTProvider
      {...props}
      locale={resolvedLocale}
      translations={translations ?? { [translationsLocale]: {} }}
    />
  );
}
