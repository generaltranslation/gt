import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hashMessageTree } from 'generaltranslation/id';
import { internalInitializeGTSRA } from '@generaltranslation/react-core/pure';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { Translation } from 'gt-i18n/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerGTProvider } from '../provider/ServerGTProvider';
import { useGT } from '../unstable';
import { useGT as useRscGT } from '../unstable.rsc';

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  // Lets the RSC useGT() be awaited outside a React render.
  return { ...react, use: <T,>(value: T) => value };
});

const name = 'Ada';
const helloHash = hashMessageTree(['Hello, ', ['name'], '!']);
const frenchHello: Translation = ['Bonjour, ', ['name'], ' !'];

function resetI18nGlobals() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Preserve the React context captured when InternalGTProvider was imported.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

function Hello() {
  const gt = useGT();
  return <span>{gt`Hello, ${{ name }}!`}</span>;
}

function renderHello(
  translations: Record<string, Record<string, Translation>>
) {
  return renderToStaticMarkup(
    <ServerGTProvider locale='fr' translations={translations}>
      <Hello />
    </ServerGTProvider>
  );
}

describe('gt-react/unstable', () => {
  beforeEach(resetI18nGlobals);
  afterEach(resetI18nGlobals);

  it('renders the source, then the provider translation once it loads', () => {
    internalInitializeGTSRA({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(renderHello({})).toBe('<span>Hello, Ada!</span>');
    expect(renderHello({ fr: { [helloHash]: frenchHello } })).toBe(
      '<span>Bonjour, Ada !</span>'
    );
  });

  it('renders a source-locale override without suspending', () => {
    internalInitializeGTSRA({ defaultLocale: 'en', locales: ['en', 'fr'] });
    function EnglishHello() {
      const gt = useGT();
      return <span>{gt({ locale: 'en' })`Hello, ${{ name }}!`}</span>;
    }

    // A suspension here would make the synchronous render throw.
    expect(
      renderToStaticMarkup(
        <ServerGTProvider
          locale='fr'
          translations={{ fr: { [helloHash]: frenchHello } }}
        >
          <EnglishHello />
        </ServerGTProvider>
      )
    ).toBe('<span>Hello, Ada!</span>');
  });

  it('binds the RSC useGT() to the condition store locale', async () => {
    internalInitializeGTSRA({
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      loadTranslations: async (locale: string) =>
        locale === 'fr' ? { [helloHash]: frenchHello } : {},
    });
    createConditionStoreSingleton('unused').setConditionStore({
      getLocale: () => 'fr',
      getEnableI18n: () => true,
    } as Parameters<
      ReturnType<typeof createConditionStoreSingleton>['setConditionStore']
    >[0]);

    const gt = await useRscGT();

    expect(gt`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
  });
});
