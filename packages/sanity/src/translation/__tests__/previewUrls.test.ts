import { NEVER, of } from 'rxjs';
import type { DocumentPreviewStore, SanityDocument, Schema } from 'sanity';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import { resolvePreviewUrls, type PreviewUrlConfig } from '../previewUrls';

const config: PreviewUrlConfig = {
  origin: 'https://staging.acme.test',
  locations: {
    page: {
      select: { slug: 'slug.current' },
      resolve: (doc) =>
        doc && {
          locations: [
            { title: 'Page', href: `/en/${doc.slug}` },
            { title: 'Index', href: '/en' },
          ],
        },
    },
    settings: { locations: [{ title: 'Home', href: '/en' }] },
  },
};

const schema = {
  get: (name: string) =>
    ['page', 'settings', 'author'].includes(name)
      ? { name, jsonType: 'object' }
      : undefined,
} as unknown as Schema;

const doc = (_id: string, _type: string) =>
  ({ _id, _type }) as unknown as SanityDocument;

/** Answers with the selected fields of the published documents given. */
function previewStoreFor(published: Record<string, Record<string, unknown>>) {
  const observeForPreview = vi.fn((value: { _ref: string }) =>
    of({ type: undefined, snapshot: published[value._ref] ?? null })
  );
  return {
    store: { observeForPreview } as unknown as DocumentPreviewStore,
    observeForPreview,
  };
}

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue(config);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolvePreviewUrls', () => {
  test('resolves nothing when the plugin has no previewUrl', async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue(null);
    const { store, observeForPreview } = previewStoreFor({});

    const { urls } = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      store
    );

    expect(urls.size).toBe(0);
    expect(observeForPreview).not.toHaveBeenCalled();
  });

  test('links a document to its first location on the origin', async () => {
    const { store } = previewStoreFor({ pricing: { slug: 'pricing' } });

    const resolved = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      store
    );

    expect(resolved).toEqual({
      urls: new Map([['pricing', 'https://staging.acme.test/en/pricing']]),
      failures: [],
    });
  });

  test("selects a draft's published fields as Presentation does", async () => {
    const { store, observeForPreview } = previewStoreFor({
      pricing: { slug: 'pricing' },
    });

    const { urls } = await resolvePreviewUrls(
      [doc('drafts.pricing', 'page')],
      schema,
      store
    );

    expect(urls.get('pricing')).toBe('https://staging.acme.test/en/pricing');
    expect(observeForPreview).toHaveBeenCalledWith(
      { _type: 'reference', _ref: 'pricing' },
      expect.objectContaining({
        name: 'page',
        preview: { select: { slug: 'slug.current' } },
      }),
      { perspective: ['published'] }
    );
  });

  test('gives an unpublished document no link', async () => {
    const { store } = previewStoreFor({});

    const { urls } = await resolvePreviewUrls(
      [doc('drafts.pricing', 'page')],
      schema,
      store
    );

    expect(urls.size).toBe(0);
  });

  test('links a type with fixed locations without reading the document', async () => {
    const { store, observeForPreview } = previewStoreFor({});

    const { urls } = await resolvePreviewUrls(
      [doc('siteSettings', 'settings')],
      schema,
      store
    );

    expect(urls.get('siteSettings')).toBe('https://staging.acme.test/en');
    expect(observeForPreview).not.toHaveBeenCalled();
  });

  test("keeps the other documents' links when one document fails", async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
      ...config,
      locations: {
        ...config.locations,
        settings: {
          select: {},
          resolve: () => {
            throw new Error('resolver threw');
          },
        },
      },
    });
    const { store } = previewStoreFor({
      pricing: { slug: 'pricing' },
      siteSettings: {},
    });

    const resolved = await resolvePreviewUrls(
      [doc('siteSettings', 'settings'), doc('pricing', 'page')],
      schema,
      store
    );

    expect(resolved.urls).toEqual(
      new Map([['pricing', 'https://staging.acme.test/en/pricing']])
    );
    expect(resolved.failures).toEqual([new Error('resolver threw')]);
  });

  test('gives up on a read that never answers', async () => {
    vi.useFakeTimers();
    const store = {
      observeForPreview: () => NEVER,
    } as unknown as DocumentPreviewStore;

    const resolving = resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      store
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const resolved = await resolving;

    expect(resolved.urls.size).toBe(0);
    expect(resolved.failures).toHaveLength(1);
    vi.useRealTimers();
  });

  test('gives a type without locations no link', async () => {
    const { store } = previewStoreFor({ jane: { slug: 'jane' } });

    const { urls } = await resolvePreviewUrls(
      [doc('jane', 'author')],
      schema,
      store
    );

    expect(urls.size).toBe(0);
  });
});
