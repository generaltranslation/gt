import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SanityDocument } from 'sanity';
import { api, pluginConfig } from '../../adapter/core';
import {
  createGroqClient,
  metadataDoc,
} from '../../utils/__tests__/groqClient';

const mocks = vi.hoisted(() => ({
  client: null as unknown,
  schema: {},
  secrets: { project: 'p' },
  documentStore: {
    // The open document's group, as the Studio listener reports it. Never
    // emitting leaves the dialog on its initial role: a source-locale
    // document shown as an original before its lookup returns.
    listenQuery: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
  },
  toastPush: vi.fn(),
  uploadFiles: vi.fn(),
  uploadTranslations: vi.fn(),
  initProject: vi.fn(),
  createJobs: vi.fn(),
  collectExistingTranslations: vi.fn(),
}));

vi.mock('sanity', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sanity')>()),
  useSchema: () => mocks.schema,
  useDocumentStore: () => mocks.documentStore,
}));
vi.mock('@sanity/ui/toast', () => ({
  useToast: () => ({ push: mocks.toastPush }),
}));
vi.mock('../../hooks/useClient', () => ({ useClient: () => mocks.client }));
vi.mock('../../hooks/useSecrets', () => ({
  useSecrets: () => ({ loading: false, secrets: mocks.secrets }),
}));
vi.mock('../../adapter/getLocales', () => ({
  getLocales: vi.fn(async () => [
    { localeId: 'en', enabled: true },
    { localeId: 'fr', enabled: true },
  ]),
}));
vi.mock('../../translation/strategy', () => ({
  getTranslationStrategy: () => ({
    level: 'document',
    serialize: (doc: SanityDocument) => ({ content: doc._id }),
  }),
}));
vi.mock('../../translation/uploadFiles', () => ({
  uploadFiles: mocks.uploadFiles,
}));
vi.mock('../../translation/uploadTranslations', () => ({
  uploadTranslations: mocks.uploadTranslations,
}));
vi.mock('../../translation/initProject', () => ({
  initProject: mocks.initProject,
}));
vi.mock('../../translation/createJobs', () => ({
  createJobs: mocks.createJobs,
}));
vi.mock('../../translation/collectExistingTranslations', () => ({
  collectExistingTranslations: mocks.collectExistingTranslations,
}));

const { TranslationsProvider, useTranslations } =
  await import('../TranslationsProvider');

type Context = ReturnType<typeof useTranslations>;

let container: HTMLDivElement;
let root: Root;
let latest: Context | null = null;

function Probe() {
  latest = useTranslations();
  return null;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderProvider(singleDocument?: SanityDocument) {
  await act(async () => {
    root.render(
      createElement(TranslationsProvider, {
        singleDocument,
        children: createElement(Probe),
      })
    );
  });
  await flush();
  await flush();
  return latest!;
}

const page = (id: string, language: string) =>
  ({
    _id: id,
    _type: 'page',
    _rev: 'r1',
    language,
  }) as unknown as SanityDocument;

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  root = createRoot(container);
  latest = null;
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  vi.spyOn(pluginConfig, 'getTranslateDocuments').mockReturnValue([
    { type: 'page' },
  ]);
  // No branch: nothing refreshes statuses in the background.
  vi.spyOn(api, 'createBranch').mockReturnValue(new Promise(() => {}));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.uploadFiles.mockResolvedValue({ uploadedFiles: [] });
  mocks.collectExistingTranslations.mockResolvedValue(new Map());
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Save Local Edits', () => {
  test('refuses a source-locale translation of another original before uploading', async () => {
    // The en page is a translation of a fr original. Its group lookup has
    // not returned, so the dialog still shows it as an original.
    const { client } = createGroqClient([
      page('page-fr', 'fr'),
      page('page-en', 'en'),
      metadataDoc(
        'm',
        [
          ['fr', 'page-fr'],
          ['en', 'page-en'],
        ],
        { gtSourceLanguage: 'fr' }
      ),
    ]);
    mocks.client = Object.assign(client, {
      config: () => ({ projectId: 'p', dataset: 'd' }),
    });

    const context = await renderProvider(page('page-en', 'en'));
    expect(context.documentRole).toEqual({
      status: 'resolved',
      role: { kind: 'original', language: 'en' },
    });

    await act(() => context.handleUploadExistingTranslations());

    expect(mocks.uploadFiles).not.toHaveBeenCalled();
    expect(mocks.uploadTranslations).not.toHaveBeenCalled();
    expect(mocks.toastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Local edits were not saved',
        description:
          'This document is a translation of fr. Translate from the fr original instead.',
        status: 'error',
      })
    );
  });

  test('uploads a source-locale original', async () => {
    const { client } = createGroqClient([page('page-en', 'en')]);
    mocks.client = Object.assign(client, {
      config: () => ({ projectId: 'p', dataset: 'd' }),
    });

    const context = await renderProvider(page('page-en', 'en'));
    await act(() => context.handleUploadExistingTranslations());

    expect(mocks.uploadFiles).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          info: expect.objectContaining({ documentId: 'page-en' }),
        }),
      ],
      { project: 'p' }
    );
  });
});

describe('Translate All', () => {
  test('drops a document that stopped being an original after the page loaded', async () => {
    const { client, dataset } = createGroqClient([
      page('a', 'en'),
      page('b-en', 'en'),
      page('b-fr', 'fr'),
    ]);
    mocks.client = Object.assign(client, {
      config: () => ({ projectId: 'p', dataset: 'd' }),
    });

    const context = await renderProvider();
    expect(context.documents.map((doc) => doc._id).sort()).toEqual([
      'a',
      'b-en',
    ]);

    // Before Translate All is clicked, b-en is added as the en translation
    // of a fr original.
    dataset.push(
      metadataDoc(
        'm-b',
        [
          ['fr', 'b-fr'],
          ['en', 'b-en'],
        ],
        { gtSourceLanguage: 'fr' }
      )
    );

    await act(() => context.handleTranslateAll());

    expect(mocks.uploadFiles).toHaveBeenCalledTimes(1);
    expect(
      mocks.uploadFiles.mock.calls[0][0].map(
        (file: { info: { documentId: string } }) => file.info.documentId
      )
    ).toEqual(['a']);
    expect(mocks.toastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        title:
          'Skipped 1 document(s) that are no longer the original of their translation group',
        status: 'warning',
      })
    );
    expect(mocks.toastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Translation tasks created for 1 documents',
      })
    );
  });

  test('uploads nothing when every loaded document stopped being an original', async () => {
    const { client, dataset } = createGroqClient([
      page('b-en', 'en'),
      page('b-fr', 'fr'),
    ]);
    mocks.client = Object.assign(client, {
      config: () => ({ projectId: 'p', dataset: 'd' }),
    });

    const context = await renderProvider();
    dataset.push(
      metadataDoc(
        'm-b',
        [
          ['fr', 'b-fr'],
          ['en', 'b-en'],
        ],
        { gtSourceLanguage: 'fr' }
      )
    );

    await act(() => context.handleTranslateAll());

    expect(mocks.uploadFiles).not.toHaveBeenCalled();
    expect(mocks.createJobs).not.toHaveBeenCalled();
  });
});
