import { vi } from 'vitest';
import { evaluate, parse } from 'groq-js';
import type { SanityClient } from 'sanity';
import type { TranslationGroupMetadata } from '../translationSource';

type Doc = Record<string, unknown> & { _id: string };

type InsertOperation = {
  documentId: string;
  operation: string;
  location: string;
  items: Record<string, unknown>[];
};

/**
 * A minimal in-memory Sanity client: queries run through Sanity's own GROQ
 * engine, and the writes the translation import path makes are applied to the
 * dataset so follow-up queries see them.
 */
export function createGroqClient(initial: Doc[]) {
  const dataset: Doc[] = initial.map((doc) => structuredClone(doc));
  const inserts: InsertOperation[] = [];
  let generated = 0;

  const find = (id: string) => dataset.find((doc) => doc._id === id);

  const fetch = vi.fn(
    async (query: string, params: Record<string, unknown> = {}) => {
      const value = await evaluate(parse(query), { dataset, params });
      return value.get();
    }
  );

  const createIfNotExists = vi.fn(async (doc: Doc) => {
    const existing = find(doc._id);
    if (existing) return existing;
    const created = { ...structuredClone(doc), _createdAt: '2026-01-01' };
    dataset.push(created);
    return created;
  });

  const create = vi.fn(async (doc: Doc) => {
    const id =
      doc._id === 'drafts.' ? `drafts.generated-${++generated}` : doc._id;
    const created = { ...structuredClone(doc), _id: id };
    dataset.push(created);
    return created;
  });

  const applyInsert = (
    documentId: string,
    operation: string,
    location: string,
    items: Record<string, unknown>[]
  ) => {
    inserts.push({ documentId, operation, location, items });
    const target = find(documentId);
    if (!target) return;
    const translations = (target.translations ?? []) as Record<
      string,
      unknown
    >[];
    if (operation === 'replace') {
      const language = /== "([^"]+)"/.exec(location)?.[1];
      target.translations = translations.map((entry) =>
        entry.language === language ? items[0] : entry
      );
    } else {
      target.translations = [...translations, ...items];
    }
  };

  const transaction = vi.fn(() => {
    const tx = {
      createIfNotExists: vi.fn(() => tx),
      patch: vi.fn(
        (
          documentId: string,
          build: (patch: {
            insert: (
              operation: string,
              location: string,
              items: Record<string, unknown>[]
            ) => unknown;
            set: (value: unknown) => unknown;
          }) => void
        ) => {
          const patch = {
            insert: (
              operation: string,
              location: string,
              items: Record<string, unknown>[]
            ) => {
              applyInsert(documentId, operation, location, items);
              return patch;
            },
            set: () => patch,
          };
          build(patch);
          return tx;
        }
      ),
      commit: vi.fn(async () => ({})),
    };
    return tx;
  });

  const patch = vi.fn(() => ({ commit: vi.fn(async () => ({})) }));

  const client = {
    fetch,
    create,
    createIfNotExists,
    transaction,
    patch,
  } as unknown as SanityClient;

  return { client, dataset, inserts, fetch, create, createIfNotExists, patch };
}

/** A `translation.metadata` document with one entry per `[language, ref]`. */
export function metadataDoc(
  id: string,
  entries: [string, string][],
  extra: Record<string, unknown> = {}
): Doc & TranslationGroupMetadata {
  return {
    _id: id,
    _type: 'translation.metadata',
    _createdAt: '2025-01-01',
    translations: entries.map(([language, ref], index) => ({
      _key: `k${index}`,
      _type: 'internationalizedArrayReferenceValue',
      language,
      value: { _type: 'reference', _ref: ref },
    })),
    ...extra,
  };
}
