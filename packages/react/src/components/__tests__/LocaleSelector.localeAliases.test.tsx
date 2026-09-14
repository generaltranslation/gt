import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { LocaleSelector } from '../LocaleSelector';
import { ServerGTProvider } from '../../provider/ServerGTProvider';

function resetConfig() {
  // Keep the React context captured by InternalGTProvider at module load.
  const registry = Reflect.get(globalThis, '__generaltranslation');
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

function configureAliases() {
  initializeI18nConfig({
    defaultLocale: 'en-us',
    locales: ['en-US', 'en-GB', 'fr-FR'],
    customMapping: {
      'en-us': { code: 'en-US' },
      'en-gb': { code: 'en-GB' },
      'fr-fr': { code: 'fr-FR' },
    },
  });
}

function renderSelector(locale: string, locales?: string[]) {
  return renderToStaticMarkup(
    <ServerGTProvider locale={locale} translations={{}}>
      <LocaleSelector locales={locales} />
    </ServerGTProvider>
  );
}

describe('LocaleSelector configured aliases', () => {
  beforeEach(resetConfig);
  afterEach(resetConfig);

  it('selects the current alias and deduplicates automatic options', () => {
    configureAliases();
    const html = renderSelector('fr-fr');

    expect(html).toContain('value="fr-fr" selected=""');
    expect(html.match(/<option /g)).toHaveLength(3);
    expect(html).toContain('value="en-us"');
    expect(html).toContain('value="en-gb"');
    expect(html).not.toContain('value="fr-FR"');
  });

  it('preserves an explicit alias list and its order', () => {
    configureAliases();
    const html = renderSelector('fr-fr', ['fr-fr', 'en-gb']);

    expect(html).toContain('value="fr-fr" selected=""');
    expect(html.match(/<option /g)).toHaveLength(2);
    expect(html.indexOf('value="fr-fr"')).toBeLessThan(
      html.indexOf('value="en-gb"')
    );
  });

  it('keeps canonical options when no aliases are configured', () => {
    initializeI18nConfig({
      defaultLocale: 'en-US',
      locales: ['en-US', 'fr-FR'],
    });

    const html = renderSelector('fr-FR');
    expect(html).toContain('value="fr-FR" selected=""');
    expect(html.match(/<option /g)).toHaveLength(2);
  });
});
