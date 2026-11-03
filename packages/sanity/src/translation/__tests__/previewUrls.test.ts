import type { SanityClient, SanityDocument } from 'sanity';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import { createGroqClient } from '../../utils/__tests__/groqClient';
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
    post: {
      select: {
        author: 'author.slug.current',
        category: 'categories.0.slug.current',
        slug: 'slug.current',
      },
      resolve: (doc) =>
        doc && {
          locations: [
            {
              title: 'Post',
              href: `/en/${doc.category}/${doc.author}/${doc.slug}`,
            },
          ],
        },
    },
    settings: { locations: [{ title: 'Home', href: '/en' }] },
  },
};

const doc = (_id: string, _type: string) =>
  ({ _id, _type }) as unknown as SanityDocument;

const dataset = [
  { _id: 'pricing', _type: 'page', slug: { current: 'pricing' } },
  { _id: 'drafts.pricing', _type: 'page', slug: { current: 'draft-pricing' } },
  { _id: 'drafts.unpublished', _type: 'page', slug: { current: 'new' } },
  { _id: 'jane', _type: 'author', slug: { current: 'jane' } },
  { _id: 'news', _type: 'category', slug: { current: 'news' } },
  {
    _id: 'launch',
    _type: 'post',
    slug: { current: 'launch' },
    author: { _type: 'reference', _ref: 'jane' },
    categories: [{ _key: 'a', _type: 'reference', _ref: 'news' }],
  },
];

function client() {
  const groq = createGroqClient(dataset);
  return { client: groq.client as SanityClient, fetch: groq.fetch };
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
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls([doc('pricing', 'page')], sanity);

    expect(urls.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('links a document to its first location on the origin', async () => {
    const resolved = await resolvePreviewUrls(
      [doc('pricing', 'page')],
      client().client
    );

    expect(resolved).toEqual({
      urls: new Map([['pricing', 'https://staging.acme.test/en/pricing']]),
      failures: [],
    });
  });

  test("links a draft by its published version's fields", async () => {
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls(
      [doc('drafts.pricing', 'page')],
      sanity
    );

    expect(urls.get('pricing')).toBe('https://staging.acme.test/en/pricing');
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      { ids: ['pricing'] },
      { perspective: 'published' }
    );
  });

  test('follows references and array items along a select path', async () => {
    const { urls } = await resolvePreviewUrls(
      [doc('launch', 'post')],
      client().client
    );

    expect(urls.get('launch')).toBe(
      'https://staging.acme.test/en/news/jane/launch'
    );
  });

  test('gives an unpublished document no link', async () => {
    const { urls } = await resolvePreviewUrls(
      [doc('drafts.unpublished', 'page')],
      client().client
    );

    expect(urls.size).toBe(0);
  });

  test('links a type with fixed locations without reading the document', async () => {
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls(
      [doc('siteSettings', 'settings')],
      sanity
    );

    expect(urls.get('siteSettings')).toBe('https://staging.acme.test/en');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('gives a type without locations no link', async () => {
    const { urls } = await resolvePreviewUrls(
      [doc('jane', 'author')],
      client().client
    );

    expect(urls.size).toBe(0);
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

    const resolved = await resolvePreviewUrls(
      [doc('siteSettings', 'settings'), doc('pricing', 'page')],
      client().client
    );

    expect(resolved.urls).toEqual(
      new Map([['pricing', 'https://staging.acme.test/en/pricing']])
    );
    expect(resolved.failures).toEqual([new Error('resolver threw')]);
  });

  test('reports a failed read and links nothing', async () => {
    const { client: sanity, fetch } = client();
    fetch.mockRejectedValueOnce(new Error('network down'));

    const resolved = await resolvePreviewUrls([doc('pricing', 'page')], sanity);

    expect(resolved).toEqual({
      urls: new Map(),
      failures: [new Error('network down')],
    });
  });
});
