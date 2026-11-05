import type { SanityClient } from 'sanity';
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

const target = (id: string, type: string, language = 'en-US') => ({
  id,
  type,
  language,
});

const dataset = [
  { _id: 'pricing', _type: 'page', slug: { current: 'pricing' } },
  { _id: 'drafts.pricing', _type: 'page', slug: { current: 'draft-pricing' } },
  { _id: 'drafts.unpublished', _type: 'page', slug: { current: 'new' } },
  { _id: 'jane', _type: 'author', slug: { current: 'jane' } },
  { _id: 'news', _type: 'category', slug: { current: 'news' } },
  {
    _id: 'draft-author-post',
    _type: 'post',
    slug: { current: 'hello' },
    author: { _type: 'reference', _ref: 'sam' },
    categories: [{ _key: 'a', _type: 'reference', _ref: 'news' }],
  },
  { _id: 'drafts.sam', _type: 'author', slug: { current: 'sam' } },
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

    const { urls } = await resolvePreviewUrls(
      [target('pricing', 'page')],
      sanity
    );

    expect(urls).toEqual([undefined]);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('links a document to its first location on the origin', async () => {
    const resolved = await resolvePreviewUrls(
      [target('pricing', 'page')],
      client().client
    );

    expect(resolved).toEqual({
      urls: ['https://staging.acme.test/en/pricing'],
      failures: [],
    });
  });

  test("reads a document's published version", async () => {
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls(
      [target('pricing', 'page')],
      sanity
    );

    expect(urls).toEqual(['https://staging.acme.test/en/pricing']);
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      { ids: ['pricing'] },
      { perspective: 'published' }
    );
  });

  test('reads drafts in the drafts perspective, so an unpublished translation gets its own page', async () => {
    const { urls } = await resolvePreviewUrls(
      [target('pricing', 'page'), target('unpublished', 'page')],
      client().client,
      'drafts'
    );

    expect(urls).toEqual([
      'https://staging.acme.test/en/draft-pricing',
      'https://staging.acme.test/en/new',
    ]);
  });

  test("passes each target's language to the resolver", async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
      ...config,
      locations: {
        page: {
          select: { slug: 'slug.current' },
          resolve: (doc, { language }) =>
            doc && {
              locations: [
                {
                  title: 'Page',
                  href: `/${language.slice(0, 2)}/${String(doc.slug)}`,
                },
              ],
            },
        },
      },
    });

    const { urls } = await resolvePreviewUrls(
      [target('pricing', 'page', 'es-ES'), target('pricing', 'page', 'fr-FR')],
      client().client
    );

    expect(urls).toEqual([
      'https://staging.acme.test/es/pricing',
      'https://staging.acme.test/fr/pricing',
    ]);
  });

  test('follows references and array items along a select path', async () => {
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls(
      [target('launch', 'post')],
      sanity
    );

    expect(urls).toEqual(['https://staging.acme.test/en/news/jane/launch']);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("reads a reference's own fields, such as an array item's _key, without following it", async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
      ...config,
      locations: {
        post: {
          select: { section: 'categories.0._key', slug: 'slug.current' },
          resolve: (doc) =>
            doc && {
              locations: [
                { title: 'Post', href: `/en/${doc.slug}#${doc.section}` },
              ],
            },
        },
      },
    });
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls(
      [target('launch', 'post')],
      sanity
    );

    expect(urls).toEqual(['https://staging.acme.test/en/launch#a']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('reads a cross-dataset reference from its own dataset', async () => {
    const local = createGroqClient([
      ...dataset,
      { _id: 'remote-jane', _type: 'author', slug: { current: 'local-jane' } },
      {
        _id: 'remote-post',
        _type: 'post',
        slug: { current: 'remote' },
        author: {
          _type: 'crossDatasetReference',
          _ref: 'remote-jane',
          _projectId: 'other-project',
          _dataset: 'authors',
        },
        categories: [{ _key: 'a', _type: 'reference', _ref: 'news' }],
      },
    ]);
    const remote = createGroqClient([
      { _id: 'remote-jane', _type: 'author', slug: { current: 'jane' } },
    ]);
    const withConfig = vi.fn(() => remote.client);
    const sanity = { ...local.client, withConfig } as unknown as SanityClient;

    const { urls } = await resolvePreviewUrls(
      [target('remote-post', 'post')],
      sanity
    );

    expect(urls).toEqual(['https://staging.acme.test/en/news/jane/remote']);
    expect(withConfig).toHaveBeenCalledWith({
      projectId: 'other-project',
      dataset: 'authors',
    });
  });

  test('keeps the links a failed remote dataset read does not affect', async () => {
    const local = createGroqClient([
      ...dataset,
      {
        _id: 'remote-post',
        _type: 'post',
        slug: { current: 'remote' },
        author: {
          _type: 'crossDatasetReference',
          _ref: 'remote-jane',
          _projectId: 'other-project',
          _dataset: 'authors',
        },
        categories: [{ _key: 'a', _type: 'reference', _ref: 'news' }],
      },
    ]);
    const denied = new Error('Not allowed to read dataset authors');
    const remote = { fetch: vi.fn().mockRejectedValue(denied) };
    const sanity = {
      ...local.client,
      withConfig: () => remote,
    } as unknown as SanityClient;

    const resolved = await resolvePreviewUrls(
      [
        target('remote-post', 'post'),
        target('pricing', 'page'),
        target('launch', 'post'),
      ],
      sanity
    );

    expect(resolved).toEqual({
      urls: [
        undefined,
        'https://staging.acme.test/en/pricing',
        'https://staging.acme.test/en/news/jane/launch',
      ],
      failures: [denied],
    });
  });

  test('reads nothing past a reference to an unpublished document', async () => {
    const resolve = vi.fn(() => null);
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
      ...config,
      locations: {
        post: { select: { author: 'author.slug.current' }, resolve },
      },
    });

    await resolvePreviewUrls(
      [target('draft-author-post', 'post')],
      client().client
    );

    expect(resolve).toHaveBeenCalledWith(
      { author: undefined },
      { language: 'en-US' }
    );
  });

  test('gives an unpublished document no link', async () => {
    const { urls } = await resolvePreviewUrls(
      [target('unpublished', 'page')],
      client().client
    );

    expect(urls).toEqual([undefined]);
  });

  test('gives an unpublished document no link when its resolver ignores a missing document', async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
      ...config,
      locations: {
        page: {
          select: { slug: 'slug.current' },
          resolve: (doc) => ({
            locations: [{ title: 'Page', href: `/en/${doc?.slug}` }],
          }),
        },
      },
    });

    const { urls } = await resolvePreviewUrls(
      [target('unpublished', 'page')],
      client().client
    );

    expect(urls).toEqual([undefined]);
  });

  test('links a type with fixed locations without reading the document', async () => {
    const { client: sanity, fetch } = client();

    const { urls } = await resolvePreviewUrls(
      [target('siteSettings', 'settings')],
      sanity
    );

    expect(urls).toEqual(['https://staging.acme.test/en']);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('gives a type without locations no link', async () => {
    const { urls } = await resolvePreviewUrls(
      [target('jane', 'author')],
      client().client
    );

    expect(urls).toEqual([undefined]);
  });

  test("keeps the other documents' links when one document fails", async () => {
    vi.spyOn(pluginConfig, 'getPreviewUrl').mockReturnValue({
      ...config,
      locations: {
        ...config.locations,
        post: {
          select: {},
          resolve: () => {
            throw new Error('resolver threw');
          },
        },
      },
    });

    const resolved = await resolvePreviewUrls(
      [target('launch', 'post'), target('pricing', 'page')],
      client().client
    );

    expect(resolved.urls).toEqual([
      undefined,
      'https://staging.acme.test/en/pricing',
    ]);
    expect(resolved.failures).toEqual([new Error('resolver threw')]);
  });

  test('reports a failed read and still links fixed locations', async () => {
    const { client: sanity, fetch } = client();
    fetch.mockRejectedValueOnce(new Error('network down'));

    const resolved = await resolvePreviewUrls(
      [target('pricing', 'page'), target('siteSettings', 'settings')],
      sanity
    );

    expect(resolved).toEqual({
      urls: [undefined, 'https://staging.acme.test/en'],
      failures: [new Error('network down')],
    });
  });
});
