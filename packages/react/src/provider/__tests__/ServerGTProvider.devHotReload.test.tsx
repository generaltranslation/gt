import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeI18nConfig,
  ReactI18nCache,
  setReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { T } from '@generaltranslation/react-core/components';
import { ServerGTProvider } from '../ServerGTProvider';

function resetGTGlobals() {
  const registry = Reflect.get(globalThis, '__generaltranslation');
  // Preserve the React context captured when InternalGTProvider was imported.
  if (registry) Reflect.deleteProperty(registry, 'i18n');
}

describe('ServerGTProvider dev hot reload', () => {
  beforeEach(resetGTGlobals);
  afterEach(() => {
    resetGTGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('requests a missing translation while rendering on the server', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const config = {
      defaultLocale: 'en',
      locales: ['en', 'fr'],
      projectId: 'project-id',
      apiKey: 'api-key',
    };
    initializeI18nConfig(config);
    const cache = new ReactI18nCache(config);
    const lookupTranslationWithFallback = vi
      .spyOn(cache, 'lookupTranslationWithFallback')
      .mockResolvedValue(undefined);
    setReactI18nCache(cache);

    renderToStaticMarkup(
      <ServerGTProvider locale='fr' translations={{}}>
        <T>Hello</T>
      </ServerGTProvider>
    );

    expect(lookupTranslationWithFallback).toHaveBeenCalledWith(
      'fr',
      'Hello',
      expect.objectContaining({ $format: 'JSX' })
    );
  });
});
