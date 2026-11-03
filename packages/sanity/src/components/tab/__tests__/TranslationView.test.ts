import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ThemeProvider } from '@sanity/ui';
import { ToastProvider } from '@sanity/ui/toast';
import { buildTheme } from '@sanity/ui/theme';
import { pluginConfig } from '../../../adapter/core';
import type { DocumentRoleState } from '../../../utils/documentRoleState';

const translations = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('../../TranslationsProvider', () => ({
  useTranslations: () => translations.current,
}));

vi.mock('../../../hooks/useClient', () => ({
  useClient: () => ({
    config: () => ({ projectId: 'p', dataset: 'd' }),
    fetch: vi.fn(async () => []),
  }),
}));

const { TranslationView } = await import('../TranslationView');

// The first Sanity UI render pays a one-time warm-up cost: ~0.6s locally, but
// over 5s on a busy CI runner.
vi.setConfig({ testTimeout: 30_000 });

const theme = buildTheme();
let container: HTMLDivElement;
let root: Root;

function setTranslations({
  language,
  preserveExistingTranslations,
  documentRole = {
    status: 'resolved',
    role: { kind: 'original', language },
  },
}: {
  language: string;
  preserveExistingTranslations: boolean;
  documentRole?: DocumentRoleState;
}) {
  const setPreserveExistingTranslations = vi.fn();
  translations.current = {
    documents: [{ _id: 'page', _type: 'page', _rev: 'r1', language }],
    locales: [
      { localeId: 'en', enabled: true },
      { localeId: 'fr', enabled: true },
      { localeId: 'de', enabled: true },
    ],
    translationStatuses: new Map(),
    pendingTranslations: new Set(),
    importingTranslations: new Set(),
    importedTranslations: new Set(),
    branchId: 'b',
    isBusy: false,
    isRefreshing: false,
    autoRefresh: false,
    autoImport: false,
    autoPatchReferences: false,
    autoPublish: false,
    preserveExistingTranslations,
    setPreserveExistingTranslations,
    getVersionId: () => 'r1',
    documentRole,
    excludedLocale: language,
    setLocales: vi.fn(),
    setAutoRefresh: vi.fn(),
    setAutoImport: vi.fn(),
    setAutoPatchReferences: vi.fn(),
    setAutoPublish: vi.fn(),
    handleTranslateAll: vi.fn(),
    handleUploadExistingTranslations: vi.fn(),
    handleImportDocument: vi.fn(),
    handleRefreshAll: vi.fn(),
    handlePatchDocumentReferences: vi.fn(),
    handlePublishAllTranslations: vi.fn(),
  };
  return { setPreserveExistingTranslations };
}

async function renderView() {
  await act(async () => {
    root.render(
      createElement(
        ThemeProvider,
        { theme },
        createElement(ToastProvider, null, createElement(TranslationView))
      )
    );
  });
}

function preservationSwitch(): HTMLInputElement {
  const label = [...container.querySelectorAll('div, span')].find(
    (element) =>
      element.textContent === 'Save local edits before translating' &&
      element.children.length === 0
  );
  const row = label?.closest('[data-ui="Flex"]');
  const input = row?.querySelector('input[type="checkbox"]');
  if (!(input instanceof window.HTMLInputElement)) {
    throw new Error('Preservation switch not found');
  }
  return input;
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  // Feature tests run with the option on; flag-off tests turn it off.
  vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
    true
  );
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  // Sanity UI reads media queries, which jsdom does not implement.
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('TranslationView local edit preservation', () => {
  test('is off and unavailable on a non-default original even when the preference is on', async () => {
    const { setPreserveExistingTranslations } = setTranslations({
      language: 'fr',
      preserveExistingTranslations: true,
    });
    await renderView();

    const input = preservationSwitch();
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(true);
    expect(container.textContent).toContain(
      'Local edits can only be saved for translations of en documents.'
    );
    // The saved preference still applies to source-locale documents.
    expect(setPreserveExistingTranslations).not.toHaveBeenCalled();
  });

  test('cannot be turned on from a non-default original', async () => {
    const { setPreserveExistingTranslations } = setTranslations({
      language: 'fr',
      preserveExistingTranslations: false,
    });
    await renderView();

    await act(async () => preservationSwitch().click());

    expect(setPreserveExistingTranslations).not.toHaveBeenCalled();
    expect(container.ownerDocument.body.textContent).not.toContain(
      'Sanity becomes the source of truth'
    );
  });

  test('keeps working on a source-locale original', async () => {
    setTranslations({ language: 'en', preserveExistingTranslations: true });
    await renderView();

    const input = preservationSwitch();
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(false);
    expect(container.textContent).not.toContain(
      'Local edits can only be saved'
    );
  });
});

describe('TranslationView role gating', () => {
  test('explains a translation without hand-built punctuation', async () => {
    setTranslations({
      language: 'en',
      preserveExistingTranslations: false,
      documentRole: {
        status: 'resolved',
        role: { kind: 'translation', language: 'en', originalLanguage: 'fr' },
      },
    });
    await renderView();

    expect(container.textContent).toBe(
      'This document is a translation of fr. Translate from the fr original instead.'
    );
  });

  test('says the group could not be verified instead of calling it a translation', async () => {
    setTranslations({
      language: 'fr',
      preserveExistingTranslations: false,
      documentRole: { status: 'unverified' },
    });
    await renderView();

    expect(container.textContent).toContain(
      "This document's translation group couldn't be verified."
    );
    expect(container.textContent).not.toContain('translation of');
  });
});

describe('TranslationView without allowNonDefaultSourceLocales', () => {
  beforeEach(() => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
  });

  test('only offers translation on source-locale documents', async () => {
    setTranslations({ language: 'fr', preserveExistingTranslations: false });
    translations.current.documentRole = null;
    await renderView();

    expect(container.textContent).toBe(
      'Translation tools are only available for en documents.'
    );
  });

  test('shows the tools on a source-locale document without waiting for a role', async () => {
    setTranslations({ language: 'en', preserveExistingTranslations: true });
    translations.current.documentRole = null;
    await renderView();

    expect(container.querySelector('[data-ui="Spinner"]')).toBeNull();
    expect(container.textContent).toContain('Translate');
    const input = preservationSwitch();
    expect(input.checked).toBe(true);
    expect(input.disabled).toBe(false);
    expect(container.textContent).not.toContain(
      'Local edits can only be saved'
    );
  });
});
