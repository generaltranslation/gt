import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const mockBrowserConditionStore = vi.hoisted(() => vi.fn());

vi.mock('../../condition-store/BrowserConditionStore', () => ({
  BrowserConditionStore: class {
    constructor(config: unknown) {
      mockBrowserConditionStore(config);
    }

    getLocale = () => 'fr';
    setLocale = () => {};
    getRegion = () => undefined;
    setRegion = () => {};
    getEnableI18n = () => true;
    setEnableI18n = () => {};
  },
}));

vi.mock('../../condition-store/ReadOnlyBrowserConditionStore', () => ({
  ReadonlyBrowserConditionStore: class {
    constructor() {
      throw new Error('ReadonlyBrowserConditionStore should not be used');
    }
  },
}));

describe('BrowserGTProvider', () => {
  it('uses the writable browser condition store', async () => {
    const { BrowserGTProvider } = await import('../BrowserGTProvider');

    renderToStaticMarkup(
      <BrowserGTProvider locale='fr' translations={{ fr: {} }}>
        <span>content</span>
      </BrowserGTProvider>
    );

    expect(mockBrowserConditionStore).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'fr',
      })
    );
  });
});
