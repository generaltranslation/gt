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
    listenQuery: vi.fn(() => ({
      subscribe: () => ({ unsubscribe: () => {} }),
    })),
  },
  useDocumentStore: vi.fn(),
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
  useDocumentStore: mocks.useDocumentStore,
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
  // Feature tests run with the option on; flag-off tests turn it off.
  vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
    true
  );
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  vi.spyOn(pluginConfig, 'getTranslateDocuments').mockReturnValue([
    { type: 'page' },
  ]);
  // No branch: nothing refreshes statuses in the background.
  vi.spyOn(api, 'createBranch').mockReturnValue(new Promise(() => {}));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.uploadFiles.mockResolvedValue({ uploadedFiles: [] });
  mocks.collectExistingTranslations.mockResolvedValue(new Map());
  mocks.useDocumentStore.mockReturnValue(mocks.documentStore);
});

afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('document role', () => {
  test('is looked up through a Studio listener with the option on', async () => {
    const { client } = createGroqClient([page('page-en', 'en')]);
    mocks.client = Object.assign(client, {
      config: () => ({ projectId: 'p', dataset: 'd' }),
    });

    await renderProvider(page('page-en', 'en'));

    expect(mocks.useDocumentStore).toHaveBeenCalled();
    expect(mocks.documentStore.listenQuery).toHaveBeenCalledWith(
      expect.anything(),
      { id: 'page-en' },
      expect.anything()
    );
  });
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

describe('without allowNonDefaultSourceLocales', () => {
  // The Translate All selection before the option existed.
  const SOURCE_LOCALE_SELECTION = `*[!(_type in ["system.group"]) && !(_id in path("_.**")) && (_type == "page") && (!defined(language) || language == "en")]`;

  // An en page that is the translation of a fr original, in a marked group.
  const markedDataset = () => [
    page('a', 'en'),
    page('b-en', 'en'),
    page('b-fr', 'fr'),
    metadataDoc(
      'm-b',
      [
        ['fr', 'b-fr'],
        ['en', 'b-en'],
      ],
      { gtSourceLanguage: 'fr' }
    ),
  ];

  const useClient = (dataset: Parameters<typeof createGroqClient>[0]) => {
    const groq = createGroqClient(dataset);
    mocks.client = Object.assign(groq.client, {
      config: () => ({ projectId: 'p', dataset: 'd' }),
    });
    return groq;
  };

  // Nothing marked-group-aware runs: no marker read, no lookup of a group by
  // one of its members.
  const expectOnlyOriginalQueries = (fetch: {
    mock: { calls: unknown[][] };
  }) => {
    for (const [query] of fetch.mock.calls) {
      expect(query).not.toContain('gtSourceLanguage');
      expect(query).not.toContain('$id in translations[].value._ref');
    }
  };

  beforeEach(() => {
    vi.spyOn(pluginConfig, 'getAllowNonDefaultSourceLocales').mockReturnValue(
      false
    );
  });

  test('never looks up or listens to the open document’s translation group', async () => {
    const { fetch } = useClient(markedDataset());

    const context = await renderProvider(page('b-en', 'en'));

    expect(context.documentRole).toBeNull();
    expect(mocks.useDocumentStore).not.toHaveBeenCalled();
    expect(mocks.documentStore.listenQuery).not.toHaveBeenCalled();
    expectOnlyOriginalQueries(fetch);
  });

  test('Save Local Edits uploads a source-locale document without checking its group', async () => {
    const { fetch } = useClient(markedDataset());

    const context = await renderProvider(page('b-en', 'en'));
    await act(() => context.handleUploadExistingTranslations());

    expect(mocks.uploadFiles).toHaveBeenCalledWith(
      [
        {
          info: {
            documentId: 'b-en',
            versionId: 'r1',
            fileName: 'sanity/page/b-en',
          },
          serializedDocument: { content: 'b-en' },
        },
      ],
      { project: 'p' }
    );
    expect(mocks.toastPush).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' })
    );
    expectOnlyOriginalQueries(fetch);
  });

  test('Patch References reads groups through their source-locale entry only', async () => {
    // The fr document recorded for b-en links to another page.
    const dataset = markedDataset().map((doc) =>
      doc._id === 'b-fr'
        ? { ...doc, link: { _type: 'reference', _ref: 'a' } }
        : doc
    );
    const { fetch } = useClient(dataset);

    const context = await renderProvider(page('b-en', 'en'));
    await act(async () => {
      await context.handlePatchDocumentReferences();
    });

    // Its references were resolved with the original query.
    expect(
      fetch.mock.calls.some(([query]) =>
        String(query).includes('"originalRef"')
      )
    ).toBe(true);
    expectOnlyOriginalQueries(fetch);
  });

  test('treats a document in another locale as written in the source locale', async () => {
    const { getLocales } = await import('../../adapter/getLocales');
    const { fetch } = useClient([page('page-fr', 'fr')]);

    const frPage = page('page-fr', 'fr');
    const context = await renderProvider(frPage);

    expect(getLocales).toHaveBeenCalledWith({ project: 'p' }, undefined);
    expect(context.excludedLocale).toBe('en');
    expect(context.getTargetLocales(frPage)).toBe(context.locales);
    expect(context.documentRole).toBeNull();
    expectOnlyOriginalQueries(fetch);
  });

  test('Translate All loads and uploads with the original selection and no rechecks', async () => {
    const { fetch } = useClient(markedDataset());

    const context = await renderProvider();
    // Translate All runs only the original selection query to load documents.
    const selectionCalls = fetch.mock.calls.filter(
      ([query]) => query === SOURCE_LOCALE_SELECTION
    );
    expect(selectionCalls).toEqual([[SOURCE_LOCALE_SELECTION]]);
    // The translation of the fr original is picked up, as before the option.
    expect(context.documents.map((doc) => doc._id).sort()).toEqual([
      'a',
      'b-en',
    ]);
    expect(context.skippedOriginalCount).toBe(0);

    fetch.mockClear();
    await act(() => context.handleTranslateAll());

    expect(
      mocks.uploadFiles.mock.calls[0][0].map(
        (file: { info: Record<string, unknown> }) => file.info
      )
    ).toEqual([
      { documentId: 'a', versionId: 'r1', fileName: 'sanity/page/a' },
      { documentId: 'b-en', versionId: 'r1', fileName: 'sanity/page/b-en' },
    ]);
    expect(mocks.createJobs).toHaveBeenCalledWith(
      { uploadedFiles: [] },
      ['en', 'fr'],
      { project: 'p' },
      false
    );
    // Nothing is checked again before uploading.
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.toastPush).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Translation tasks created for 2 documents',
      })
    );
  });
});
