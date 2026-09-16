import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { useLocale } from '@generaltranslation/react-core/hooks';
import { ServerGTProvider } from '../ServerGTProvider';

function LocaleProbe() {
  return <span>{useLocale()}</span>;
}

describe('ServerGTProvider locale aliases', () => {
  beforeEach(() => {
    const registry = Reflect.get(globalThis, '__generaltranslation');
    // Preserve the React context captured when InternalGTProvider was imported.
    if (registry) Reflect.deleteProperty(registry, 'i18n');
  });

  afterEach(() => {
    const registry = Reflect.get(globalThis, '__generaltranslation');
    // Preserve the React context captured when InternalGTProvider was imported.
    if (registry) Reflect.deleteProperty(registry, 'i18n');
  });

  it.each([
    ['en-GB', 'en-gb'],
    ['en-gb', 'en-gb'],
    ['en-US', 'en-us'],
  ])('renders %s as %s before hydration', (locale, expected) => {
    initializeI18nConfig({
      defaultLocale: 'en-us',
      locales: ['en-us', 'en-gb'],
      customMapping: {
        'en-us': { code: 'en-US' },
        'en-gb': { code: 'en-GB' },
      },
    });

    expect(
      renderToStaticMarkup(
        <ServerGTProvider locale={locale} translations={{}}>
          <LocaleProbe />
        </ServerGTProvider>
      )
    ).toBe(`<span>${expected}</span>`);
  });

  it('keeps canonical identifiers when there is no alias', () => {
    initializeI18nConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'en-GB'],
    });

    expect(
      renderToStaticMarkup(
        <ServerGTProvider locale='en-GB' translations={{}}>
          <LocaleProbe />
        </ServerGTProvider>
      )
    ).toBe('<span>en-GB</span>');
  });
});
