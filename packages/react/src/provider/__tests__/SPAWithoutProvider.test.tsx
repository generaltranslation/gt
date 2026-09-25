// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import {
  useEnableI18n,
  useLocale,
  useRegion,
  useSetEnableI18n,
  useSetLocale,
  useSetRegion,
} from '@generaltranslation/react-core/hooks';
import { createOrUpdateBrowserConditionStore } from '../../condition-store/createBrowserConditionStore';

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

function resetGTGlobals() {
  Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
}

describe('SPA hooks without a provider', () => {
  beforeEach(resetGTGlobals);
  afterEach(resetGTGlobals);

  it('reads and writes the initialized condition store', () => {
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'es'] },
      'SPA'
    );
    createOrUpdateBrowserConditionStore({
      locale: 'fr',
      region: 'CA',
      enableI18n: true,
      _reload: () => undefined,
    });
    let setLocale!: ReturnType<typeof useSetLocale>;
    let setRegion!: ReturnType<typeof useSetRegion>;
    let setEnableI18n!: ReturnType<typeof useSetEnableI18n>;

    function App() {
      setLocale = useSetLocale();
      setRegion = useSetRegion();
      setEnableI18n = useSetEnableI18n();
      return <span>{`${useLocale()}:${useRegion()}:${useEnableI18n()}`}</span>;
    }

    expect(renderToStaticMarkup(<App />)).toContain('fr:CA:true');
    setLocale('es');
    setRegion('MX');
    setEnableI18n(false);
    expect(renderToStaticMarkup(<App />)).toContain('es:MX:false');
  });

  it('still requires a provider in server-render mode', () => {
    initializeI18nConfig({ defaultLocale: 'en' }, 'server-render');

    function App() {
      return <span>{useLocale()}</span>;
    }

    expect(() => renderToStaticMarkup(<App />)).toThrow(
      'GTContext was accessed outside of a <GTProvider>'
    );
  });
});
