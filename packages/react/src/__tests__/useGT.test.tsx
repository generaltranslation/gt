import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { hashSource } from 'generaltranslation/id';
import { createConditionStoreSingleton } from 'gt-i18n/internal';
import type { Content } from '@generaltranslation/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ServerGTProvider } from '../provider/ServerGTProvider';
import { initializeGTSRA } from '../setup/initializeGTSRA';
import { msg, useGT, useMessages } from '../index.server';
import { useGT as useRscGT, useMessages as useRscMessages } from '../index.rsc';

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();
  // Lets the RSC useGT() be awaited outside a React render.
  return { ...react, use: <T,>(value: T) => value };
});

const name = 'Ada';
const helloHash = hashSource({
  source: ['Hello, ', ['name'], '!'],
  dataFormat: 'MESSAGE_TREE',
});
const frenchHello: Content = ['Bonjour, ', ['name'], ' !'];

function resetI18nGlobals() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Preserve the React context captured when InternalGTProvider was imported.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

function Hello() {
  const t = useGT();
  return <span>{t`Hello, ${{ name }}!`}</span>;
}

const helloMessage = msg`Hello, ${{ name }}!`;

function HelloMessage() {
  const m = useMessages();
  return <span>{m(helloMessage)}</span>;
}

function renderHello(
  translations: Record<string, Record<string, Content>>,
  Component = Hello
) {
  return renderToStaticMarkup(
    <ServerGTProvider locale='fr' translations={translations}>
      <Component />
    </ServerGTProvider>
  );
}

describe('gt-react useGT and useMessages', () => {
  beforeEach(resetI18nGlobals);
  afterEach(resetI18nGlobals);

  it('renders the source, then the provider translation once it loads', () => {
    initializeGTSRA({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(renderHello({})).toBe('<span>Hello, Ada!</span>');
    expect(renderHello({ fr: { [helloHash]: frenchHello } })).toBe(
      '<span>Bonjour, Ada !</span>'
    );
  });

  it('renders msg() messages with the provider translation through useMessages()', () => {
    initializeGTSRA({ defaultLocale: 'en', locales: ['en', 'fr'] });

    expect(renderHello({}, HelloMessage)).toBe('<span>Hello, Ada!</span>');
    expect(
      renderHello({ fr: { [helloHash]: frenchHello } }, HelloMessage)
    ).toBe('<span>Bonjour, Ada !</span>');
  });

  it('binds the RSC useGT() to the condition store locale', async () => {
    initializeGTSRA({
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

    const t = await useRscGT();
    const m = await useRscMessages();

    expect(t`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
    expect(m(helloMessage)).toBe('Bonjour, Ada !');
  });
});
