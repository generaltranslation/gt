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

  it('seeds the region from the server prop on first render', () => {
    expect(
      renderToString(createElement(RegionStateProbe, { region: 'CA' }))
    ).toBe('<span>CA</span>');
  });
});
