import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockCreateBrowserConditionStore = vi.hoisted(() => vi.fn());

vi.mock('../../condition-store/createBrowserConditionStore', () => ({
  createOrUpdateBrowserConditionStore: (config: unknown) => {
    mockCreateBrowserConditionStore(config);
    return {
      getLocale: () => 'fr',
      setLocale: () => {},
      getRegion: () => undefined,
      setRegion: () => {},
      getEnableI18n: () => true,
      setEnableI18n: () => {},
    };
  },
}));

describe('BrowserGTProvider', () => {
  it('uses the writable browser condition store factory', async () => {
    const { BrowserGTProvider } = await import('../BrowserGTProvider');

    renderToStaticMarkup(
      <BrowserGTProvider
        locale='fr'
        translations={{ fr: {} }}
        dictionaries={{}}
      >
        <span>content</span>
      </BrowserGTProvider>
    );

    expect(mockCreateBrowserConditionStore).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
      })
    );
  });
});
