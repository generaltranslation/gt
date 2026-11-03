import { concat, defer, NEVER, of, throwError } from 'rxjs';
import type { SanityClient, SanityDocument, Schema } from 'sanity';
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

const publishedPage = (_id: string, slug: string) => ({
  _id,
  _type: 'page',
  _rev: `${_id}-${slug}`,
  slug: { current: slug },
});

type PublishedDocument = ReturnType<typeof publishedPage>;
type FetchOptions = { perspective?: string[] };

/**
 * A client the real preview store reads through. Like the real client, every
 * subscription is a new request: it answers from `published` as it is then,
 * and fails when `published.down` is set.
 */
function fakeClient(published: {
  documents: PublishedDocument[];
  down?: boolean;
}) {
  const requests = vi.fn();
  const fetch = vi.fn(
    (query: string, _params: unknown, _options: FetchOptions) =>
      defer(() => {
        requests();
        if (published.down) return throwError(() => new Error('network down'));
        const subqueries = query.split('*[_id in').length - 1;
        return of(
          Array.from({ length: subqueries }, () => [...published.documents])
        );
      })
  );
  const client = {
    withConfig: () => client,
    listen: () => concat(of({ type: 'welcome' }), NEVER),
    observable: { fetch },
  };
  return { client: client as unknown as SanityClient, fetch, requests };
}

beforeEach(() => {
  vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue(config);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('resolvePreviewUrls', () => {
  test('resolves nothing when the plugin has no previewUrl', async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue(null);
    const { client, fetch } = fakeClient({
      documents: [publishedPage('pricing', 'pricing')],
    });

    const { urls } = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      client
    );

    expect(urls.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('links a document to its first location on the origin', async () => {
    const { client } = fakeClient({
      documents: [publishedPage('pricing', 'pricing')],
    });

    const resolved = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      client
    );

    expect(resolved).toEqual({
      urls: new Map([['pricing', 'https://staging.acme.test/en/pricing']]),
      failures: [],
    });
  });

  test("reads a draft's published document as Presentation does", async () => {
    const { client, fetch } = fakeClient({
      documents: [publishedPage('pricing', 'pricing')],
    });

    const { urls } = await resolvePreviewUrls(
      [doc('drafts.pricing', 'page')],
      schema,
      client
    );

    expect(urls.get('pricing')).toBe('https://staging.acme.test/en/pricing');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('"pricing"'),
      expect.anything(),
      expect.objectContaining({ perspective: ['published'] })
    );
  });

  test('reads the current published page on every run', async () => {
    const published = { documents: [publishedPage('pricing', 'old')] };
    const { client } = fakeClient(published);

    const first = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      client
    );
    published.documents = [publishedPage('pricing', 'new')];
    const second = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      schema,
      client
    );

    expect(first.urls.get('pricing')).toBe('https://staging.acme.test/en/old');
    expect(second.urls.get('pricing')).toBe('https://staging.acme.test/en/new');
  });

  test('gives an unpublished document no link', async () => {
    const { client } = fakeClient({ documents: [] });

    const { urls } = await resolvePreviewUrls(
      [doc('drafts.pricing', 'page')],
      schema,
      client
    );

    expect(urls.size).toBe(0);
  });

  test('links a type with fixed locations without reading the document', async () => {
    const { client, fetch } = fakeClient({ documents: [] });

    const { urls } = await resolvePreviewUrls(
      [doc('siteSettings', 'settings')],
      schema,
      client
    );

    expect(urls.get('siteSettings')).toBe('https://staging.acme.test/en');
    expect(fetch).not.toHaveBeenCalled();
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
    const { client } = fakeClient({
      documents: [
        publishedPage('pricing', 'pricing'),
        { ...publishedPage('siteSettings', ''), _type: 'settings' },
      ],
    });

    const resolved = await resolvePreviewUrls(
      [doc('siteSettings', 'settings'), doc('pricing', 'page')],
      schema,
      client
    );

    expect(resolved.urls).toEqual(
      new Map([['pricing', 'https://staging.acme.test/en/pricing']])
    );
    expect(resolved.failures).toEqual([new Error('resolver threw')]);
  });

  test('gives up on reads that keep failing and stops retrying them', async () => {
    vi.useFakeTimers();
    const { client, requests } = fakeClient({ documents: [], down: true });

    for (let run = 0; run < 2; run++) {
      const resolving = resolvePreviewUrls(
        [doc('pricing', 'page')],
        schema,
        client
      );
      await vi.advanceTimersByTimeAsync(10_000);
      const resolved = await resolving;
      expect(resolved.urls.size).toBe(0);
      expect(resolved.failures).toHaveLength(1);
    }
    const requestsWhenGivenUp = requests.mock.calls.length;
    await vi.advanceTimersByTimeAsync(120_000);

    expect(requestsWhenGivenUp).toBeGreaterThan(0);
    expect(requests).toHaveBeenCalledTimes(requestsWhenGivenUp);
  });

  test('gives a type without locations no link', async () => {
    const { client } = fakeClient({ documents: [] });

    const { urls } = await resolvePreviewUrls(
      [doc('jane', 'author')],
      schema,
      client
    );

    expect(urls.size).toBe(0);
  });
});
