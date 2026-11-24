import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLoadCreateGTParams } = vi.hoisted(() => ({
  mockLoadCreateGTParams: vi.fn(async () => ({})),
}));

vi.mock('gt-i18n/internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('gt-i18n/internal')>()),
  createGT: () => 'gt',
  createMessages: () => 'messages',
  loadCreateGTParams: mockLoadCreateGTParams,
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(() => {
    throw new Error('No StartEvent found in AsyncLocalStorage.');
  }),
  setCookie: vi.fn(),
}));

import { getRequest } from '@tanstack/react-start/server';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import {
  getEnableI18n,
  getGT,
  getLocale,
  getMessages,
} from '../runtime.server';

type GlobalWithRegistry = {
  __generaltranslation?: {
    i18n?: Record<string, unknown>;
    tanstackStart?: Record<string, unknown>;
  };
};

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
};

function resetSingletons() {
  const globalObj = globalThis as GlobalWithRegistry;
  if (globalObj.__generaltranslation?.i18n) {
    Reflect.deleteProperty(globalObj.__generaltranslation.i18n, 'i18nConfig');
  }
  if (globalObj.__generaltranslation?.tanstackStart) {
    Reflect.deleteProperty(
      globalObj.__generaltranslation.tanstackStart,
      'conditionStore'
    );
  }
}

describe.sequential('server translation functions', () => {
  beforeEach(() => {
    resetSingletons();
    initializeI18nConfig(config);
    setConditionStore(new AsyncLocalConditionStore(config));
    mockLoadCreateGTParams.mockClear();
  });

  it('requires a TanStack Start request', () => {
    expect(() => getLocale()).toThrow(
      'Cannot read GT request state outside a request scope'
    );
  });

  it('passes request conditions to the internal translation functions', async () => {
    vi.mocked(getRequest).mockReturnValue(
      new Request('https://example.com', {
        headers: {
          cookie:
            'generaltranslation.locale=fr; generaltranslation.region=FR; generaltranslation.enable-i18n=false',
        },
      })
    );

    expect(getLocale()).toBe('fr');
    expect(getEnableI18n()).toBe(false);
    await expect(getGT()).resolves.toBe('gt');
    await expect(getMessages()).resolves.toBe('messages');
    vi.mocked(getRequest).mockRestore();

    expect(mockLoadCreateGTParams).toHaveBeenCalledTimes(2);
    expect(mockLoadCreateGTParams).toHaveBeenCalledWith({
      locale: 'fr',
      enableI18n: false,
    });
  });
});
