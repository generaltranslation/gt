import { useContext, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Content } from '@generaltranslation/format';
import type { I18nStore } from '../../i18n-store/I18nStore';
import { getGTContext } from '../context';
import { InternalGTProvider } from '../InternalGTProvider';
import { InternalTranslationsSeed } from '../InternalTranslationsSeed';

type Translations = Record<string, Record<string, Content>>;

function Provider({
  translations,
  children,
}: {
  translations: Translations;
  children?: ReactNode;
}) {
  return (
    <InternalGTProvider
      translations={translations}
      locale='fr'
      region={undefined}
      enableI18n
      setLocale={vi.fn()}
      setRegion={vi.fn()}
      setEnableI18n={vi.fn()}
      i18nStore={{ updateTranslations: vi.fn() } as unknown as I18nStore}
    >
      {children}
    </InternalGTProvider>
  );
}

function snapshotsOf(tree: (probe: ReactNode) => ReactNode) {
  const snapshots: (Translations | undefined)[] = [];
  function Probe() {
    snapshots.push(useContext(getGTContext())?.translationsSnapshot);
    return null;
  }
  renderToStaticMarkup(tree(<Probe />));
  return snapshots;
}

const root = { fr: { root: 'Racine', shared: 'Fournisseur' } };
const page = { fr: { page: 'Page', shared: 'Graine' } };

describe('InternalTranslationsSeed', () => {
  it('leaves the snapshot of a provider with no seed above it as it is', () => {
    const [snapshot] = snapshotsOf((probe) => (
      <Provider translations={root}>{probe}</Provider>
    ));
    expect(snapshot).toBe(root);
  });

  it('layers its translations over those of the provider above it', () => {
    expect(
      snapshotsOf((probe) => (
        <Provider translations={root}>
          <InternalTranslationsSeed translations={page}>
            {probe}
          </InternalTranslationsSeed>
        </Provider>
      ))
    ).toEqual([{ fr: { root: 'Racine', page: 'Page', shared: 'Graine' } }]);
  });

  it('adds its translations under those of a provider below it', () => {
    expect(
      snapshotsOf((probe) => (
        <InternalTranslationsSeed translations={page}>
          <Provider translations={root}>{probe}</Provider>
        </InternalTranslationsSeed>
      ))
    ).toEqual([
      { fr: { root: 'Racine', page: 'Page', shared: 'Fournisseur' } },
    ]);
  });

  it('reaches a provider nested below it inside another provider', () => {
    const nested = { fr: { nested: 'Imbriqué' } };
    expect(
      snapshotsOf((probe) => (
        <Provider translations={root}>
          <InternalTranslationsSeed translations={page}>
            {probe}
            <Provider translations={nested}>{probe}</Provider>
          </InternalTranslationsSeed>
        </Provider>
      ))
    ).toEqual([
      { fr: { root: 'Racine', page: 'Page', shared: 'Graine' } },
      { fr: { page: 'Page', shared: 'Graine', nested: 'Imbriqué' } },
    ]);
  });

  it('renders its children alone with no provider', () => {
    expect(
      snapshotsOf((probe) => (
        <InternalTranslationsSeed translations={page}>
          {probe}
        </InternalTranslationsSeed>
      ))
    ).toEqual([undefined]);
  });
});
