import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';
import type { InternalGTProviderProps } from '@generaltranslation/react-core/types';
import { ClientProvider } from '../ClientProvider';
import { useRegionState } from '../hooks/useRegionState';
import type { ClientProviderProps } from '../../types/config';

function getClientProviderProps(
  overrides: Partial<ClientProviderProps> = {}
): ClientProviderProps {
  return {
    children: 'Hello',
    dictionary: {},
    dictionaryTranslations: {},
    translations: {},
    locale: 'en',
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    translationRequired: false,
    dialectTranslationRequired: false,
    renderSettings: {
      method: 'default',
    },
    developmentApiEnabled: false,
    environment: 'test',
    resetLocaleCookieName: 'gt-reset-locale',
    reloadServer: vi.fn(),
    ...overrides,
  };
}

function RegionStateProbe({ region: _region }: { region: string }) {
  const { region } = useRegionState({
    _region,
    ssr: true,
    regionCookieName: 'gt-region',
  });
  return createElement('span', null, region ?? 'missing');
}

describe('ClientProvider', () => {
  it('passes the wrapper ssr override to react-core', () => {
    const element = ClientProvider(
      getClientProviderProps()
    ) as ReactElement<InternalGTProviderProps>;

    expect(element.props.ssr).toBe(true);
  });

  it('passes server-provided translation requirement state to react-core', () => {
    const element = ClientProvider(
      getClientProviderProps({
        locale: 'fr',
        translationRequired: false,
        dialectTranslationRequired: false,
      })
    ) as ReactElement<InternalGTProviderProps>;

    expect(element.props.translationRequired).toBe(false);
    expect(element.props.dialectTranslationRequired).toBe(false);
  });

  it('uses the current children as the suspense fallback after server data has loaded', () => {
    const element = ClientProvider(
      getClientProviderProps({
        children: 'Current content',
        locale: 'fr',
        translationRequired: true,
        translations: {
          hello: 'Bonjour',
        },
      })
    ) as ReactElement<InternalGTProviderProps>;

    expect(element.props.fallback).toBe('Current content');
  });

  it('keeps the suspense fallback empty while waiting for initial server data', () => {
    const element = ClientProvider(
      getClientProviderProps({
        locale: '',
      })
    ) as ReactElement<InternalGTProviderProps>;

    expect(element.props.fallback).toBeUndefined();
  });

  it('keeps the suspense fallback empty while required translations are loading', () => {
    const element = ClientProvider(
      getClientProviderProps({
        locale: 'fr',
        translationRequired: true,
        translations: null,
      })
    ) as ReactElement<InternalGTProviderProps>;

    expect(element.props.fallback).toBeUndefined();
  });

  it('seeds the region from the server prop on first render', () => {
    expect(
      renderToString(createElement(RegionStateProbe, { region: 'CA' }))
    ).toBe('<span>CA</span>');
  });
});
