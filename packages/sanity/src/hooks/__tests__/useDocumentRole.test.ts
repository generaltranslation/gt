import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { DocumentStore } from 'sanity';
import { pluginConfig } from '../../adapter/core';
import { useDocumentRole } from '../useDocumentRole';
import type { DocumentRoleState } from '../../utils/documentRoleState';
import type { TranslationGroupMetadata } from '../../utils/translationSource';
import {
  createGroqClient,
  metadataDoc,
} from '../../utils/__tests__/groqClient';

type Observer = {
  next: (value: TranslationGroupMetadata | null) => void;
  error: (error: unknown) => void;
};

/** A document store whose group listeners are driven by the test. */
function createDocumentStore() {
  const listeners = new Map<string, Observer>();
  const documentStore = {
    listenQuery: vi.fn(
      (_query: unknown, params: { id: string }, _options: unknown) => ({
        subscribe: (observer: Observer) => {
          listeners.set(params.id, observer);
          return { unsubscribe: () => listeners.delete(params.id) };
        },
      })
    ),
  } as unknown as Pick<DocumentStore, 'listenQuery'>;
  return { documentStore, listeners };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let container: HTMLDivElement;
let root: Root;
let latest: DocumentRoleState | null = null;

function Probe(props: Parameters<typeof useDocumentRole>[0]) {
  latest = useDocumentRole(props);
  return null;
}

async function render(props: Parameters<typeof useDocumentRole>[0]) {
  await act(async () => {
    root.render(createElement(Probe, props));
  });
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(pluginConfig, 'getSourceLocale').mockReturnValue('en');
  vi.spyOn(pluginConfig, 'getLanguageField').mockReturnValue('language');
  container = document.createElement('div');
  root = createRoot(container);
  latest = null;
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
});

const original = (language: string): DocumentRoleState => ({
  status: 'resolved',
  role: { kind: 'original', language },
});

describe('useDocumentRole', () => {
  test('shows a source-locale document as an original before its group loads', async () => {
    const { client } = createGroqClient([]);
    const { documentStore } = createDocumentStore();

    await render({ documentId: 'page', language: 'en', client, documentStore });

    expect(latest).toEqual(original('en'));
  });

  test('hides tools on a source-locale translation once its group loads', async () => {
    const { client } = createGroqClient([{ _id: 'page-fr', _type: 'page' }]);
    const { documentStore, listeners } = createDocumentStore();

    await render({
      documentId: 'page-en',
      language: 'en',
      client,
      documentStore,
    });
    act(() =>
      listeners.get('page-en')?.next(
        metadataDoc(
          'm',
          [
            ['fr', 'page-fr'],
            ['en', 'page-en'],
          ],
          { gtSourceLanguage: 'fr', _rev: 'r1' }
        )
      )
    );
    await flush();

    expect(latest).toEqual({
      status: 'resolved',
      role: { kind: 'translation', language: 'en', originalLanguage: 'fr' },
    });
  });

  test('waits for the group of a document in another locale', async () => {
    const { client } = createGroqClient([]);
    const { documentStore, listeners } = createDocumentStore();

    await render({
      documentId: 'page-fr',
      language: 'fr',
      client,
      documentStore,
    });
    expect(latest).toEqual({ status: 'resolving' });

    act(() => listeners.get('page-fr')?.next(null));
    await flush();
    expect(latest).toEqual(original('fr'));
  });

  test('shows an unverified state when the group cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = createGroqClient([]);
    const { documentStore, listeners } = createDocumentStore();

    await render({
      documentId: 'page-fr',
      language: 'fr',
      client,
      documentStore,
    });
    act(() => listeners.get('page-fr')?.error(new Error('offline')));
    await flush();

    expect(latest).toEqual({ status: 'unverified' });
  });

  test('updates when the document leaves its group', async () => {
    const { client } = createGroqClient([{ _id: 'page', _type: 'page' }]);
    const { documentStore, listeners } = createDocumentStore();

    await render({
      documentId: 'page-fr',
      language: 'fr',
      client,
      documentStore,
    });
    act(() =>
      listeners.get('page-fr')?.next(
        metadataDoc(
          'm',
          [
            ['en', 'page'],
            ['fr', 'page-fr'],
          ],
          { _rev: 'r1' }
        )
      )
    );
    await flush();
    expect(latest).toMatchObject({ role: { kind: 'translation' } });

    act(() => listeners.get('page-fr')?.next(null));
    await flush();
    expect(latest).toEqual(original('fr'));
  });

  test('ignores a lookup that returns after another document opened', async () => {
    const { client, fetch } = createGroqClient([
      { _id: 'page', _type: 'page' },
    ]);
    const { documentStore, listeners } = createDocumentStore();

    // The first document's lookup (does its original exist?) is held back.
    const slow = deferred<number>();
    fetch.mockImplementationOnce(() => slow.promise);

    await render({
      documentId: 'page-fr',
      language: 'fr',
      client,
      documentStore,
    });
    act(() =>
      listeners.get('page-fr')?.next(
        metadataDoc(
          'm',
          [
            ['en', 'page'],
            ['fr', 'page-fr'],
          ],
          { _rev: 'r1' }
        )
      )
    );

    // A standalone original opens before that lookup returns.
    await render({
      documentId: 'other-de',
      language: 'de',
      client,
      documentStore,
    });
    act(() => listeners.get('other-de')?.next(null));
    await flush();
    expect(latest).toEqual(original('de'));

    // The first lookup finally returns "translation"; it must not apply.
    slow.resolve(1);
    await flush();
    expect(latest).toEqual(original('de'));
  });

  test('ignores a lookup that returns after the group changed again', async () => {
    const { client, fetch } = createGroqClient([
      { _id: 'page', _type: 'page' },
    ]);
    const { documentStore, listeners } = createDocumentStore();
    const slow = deferred<number>();
    fetch.mockImplementationOnce(() => slow.promise);

    await render({
      documentId: 'page-fr',
      language: 'fr',
      client,
      documentStore,
    });
    act(() =>
      listeners.get('page-fr')?.next(
        metadataDoc(
          'm',
          [
            ['en', 'page'],
            ['fr', 'page-fr'],
          ],
          { _rev: 'r1' }
        )
      )
    );
    // Removed from the group while the first lookup is still out.
    act(() => listeners.get('page-fr')?.next(null));
    await flush();
    expect(latest).toEqual(original('fr'));

    slow.resolve(1);
    await flush();
    expect(latest).toEqual(original('fr'));
  });
});
