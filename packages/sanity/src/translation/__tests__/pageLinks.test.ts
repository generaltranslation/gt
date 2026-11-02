import { evaluate, parse } from 'groq-js';
import type { SanityClient, SanityDocument } from 'sanity';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { pluginConfig } from '../../adapter/core';
import { collectPageLinks, type PageLinksConfig } from '../pageLinks';

type Doc = Record<string, unknown> & { _id: string; _type: string };

const config: PageLinksConfig = { baseUrl: 'https://staging.acme.test' };

const isPublished = (doc: Doc) =>
  !doc._id.startsWith('drafts.') && !doc._id.startsWith('versions.');

/**
 * Answers queries with Sanity's own GROQ engine over an in-memory dataset.
 * groq-js has no perspectives, so the published perspective sees the dataset without drafts and release versions.
 */
function clientFor(dataset: Doc[]) {
  const queries: string[] = [];
  const over = (docs: Doc[]) => ({
    fetch: async (query: string, params: Record<string, unknown>) => {
      queries.push(query);
      return (await evaluate(parse(query), { dataset: docs, params })).get();
    },
    withConfig: ({ perspective }: { perspective?: string }) =>
      over(perspective === 'published' ? docs.filter(isPublished) : docs),
  });
  return { client: over(dataset) as unknown as SanityClient, queries };
}

const page = (id: string, slug: string, extra: Partial<Doc> = {}): Doc => ({
  _id: id,
  _type: 'page',
  language: 'en',
  slug: { _type: 'slug', current: slug },
  ...extra,
});

const ref = (id: string) => ({ _type: 'reference', _ref: id });

function metadata(id: string, translations: Record<string, string>): Doc {
  return {
    _id: `translation.metadata.${id}`,
    _type: 'translation.metadata',
    translations: Object.entries(translations).map(([language, docId]) => ({
      _key: language,
      language,
      value: ref(docId),
    })),
  };
}

async function linksOf(dataset: Doc[], id: string) {
  const { client } = clientFor(dataset);
  const documents = dataset.filter((doc) => doc._id === id);
  const links = await collectPageLinks(
    documents as unknown as SanityDocument[],
    client
  );
  return links.get(id);
}

beforeEach(() => {
  pluginConfig.sourceLocale = 'en';
  pluginConfig.locales = ['es'];
  pluginConfig.translationLevel = 'document';
  pluginConfig.fieldLevelDocuments = [];
  pluginConfig.languageField = 'language';
  pluginConfig.pageLinks = config;
});

afterEach(() => {
  pluginConfig.pageLinks = null;
  pluginConfig.allowNonDefaultSourceLocales = false;
});

describe('collectPageLinks', () => {
  test('sends no queries when page links are not configured', async () => {
    pluginConfig.pageLinks = null;
    const { client, queries } = clientFor([page('pricing', 'pricing')]);

    const links = await collectPageLinks(
      [page('pricing', 'pricing') as unknown as SanityDocument],
      client
    );

    expect(links.size).toBe(0);
    expect(queries).toEqual([]);
  });

  test('links a document with a slug to its page', async () => {
    expect(await linksOf([page('pricing', 'pricing')], 'pricing')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/pricing' },
    ]);
  });

  test('keeps a slug with leading slashes on the site', async () => {
    expect(await linksOf([page('pricing', '//pricing')], 'pricing')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/pricing' },
    ]);
  });

  test('links each published translation under its locale path', async () => {
    pluginConfig.pageLinks = {
      ...config,
      localePath: (locale) => `/${locale}`,
    };
    const dataset = [
      page('pricing', 'pricing'),
      page('pricing-es', 'precios', { language: 'es' }),
      metadata('pricing', { en: 'pricing', es: 'pricing-es' }),
    ];

    expect(await linksOf(dataset, 'pricing')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/en/pricing' },
      { locale: 'es', href: 'https://staging.acme.test/es/precios' },
    ]);
  });

  test('lists an original outside the source locale first', async () => {
    pluginConfig.allowNonDefaultSourceLocales = true;
    const dataset = [
      page('precios', 'precios', { language: 'es' }),
      page('pricing', 'pricing'),
      {
        ...metadata('precios', { es: 'precios', en: 'pricing' }),
        gtSourceLanguage: 'es',
      },
    ];

    expect(await linksOf(dataset, 'precios')).toEqual([
      { locale: 'es', href: 'https://staging.acme.test/es/precios' },
      { locale: 'en', href: 'https://staging.acme.test/pricing' },
    ]);
  });

  test('gives a locale no link until its translation is published', async () => {
    const dataset = [
      page('pricing', 'pricing'),
      page('drafts.pricing-es', 'precios', { language: 'es' }),
      metadata('pricing', { en: 'pricing', es: 'pricing-es' }),
    ];

    expect(await linksOf(dataset, 'pricing')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/pricing' },
    ]);
  });

  test('links a document without a page to the published pages that show it', async () => {
    const dataset = [
      { _id: 'form', _type: 'gatedForm' },
      page('video', 'resources/videos/red-teaming', { gate: ref('form') }),
      page('drafts.webinar', 'webinar', { gate: ref('form') }),
      page('versions.launch.event', 'event', { gate: ref('form') }),
      page('video-es', 'resources/videos/red-teaming', {
        language: 'es',
        gate: ref('form'),
      }),
    ];

    expect(await linksOf(dataset, 'form')).toEqual([
      {
        locale: 'en',
        href: 'https://staging.acme.test/resources/videos/red-teaming',
      },
    ]);
  });

  test('links only pages that reference the document directly', async () => {
    const dataset = [
      { _id: 'form', _type: 'gatedForm' },
      { _id: 'section', _type: 'section', form: ref('form') },
      page('home', 'home', { sections: [{ _key: 'a', ...ref('section') }] }),
    ];

    expect(await linksOf(dataset, 'form')).toEqual([]);
  });

  test('lists its own page first, then up to ten pages showing it in id order', async () => {
    const cards = Array.from({ length: 12 }, (_, index) =>
      page(`p${String(index).padStart(2, '0')}`, `p${index}`, {
        featured: ref('story'),
      })
    );
    const dataset = [
      page('story', 'customers/airtable', { _type: 'story' }),
      ...cards.reverse(),
    ];

    expect((await linksOf(dataset, 'story'))?.map((link) => link.href)).toEqual(
      [
        'https://staging.acme.test/customers/airtable',
        ...Array.from(
          { length: 9 },
          (_, index) => `https://staging.acme.test/p${index}`
        ),
      ]
    );
  });

  test('uses the Presentation locations of a type under the locale path', async () => {
    pluginConfig.pageLinks = {
      ...config,
      locations: {
        post: {
          select: { slug: 'slug.current' },
          resolve: (value) => ({
            locations: [
              { title: 'Post', href: `/blog/${value?.slug}` },
              { title: 'Blog', href: '/blog' },
            ],
          }),
        },
        settings: { locations: [{ title: 'Home', href: '/' }] },
      },
    };
    const dataset = [
      page('post', 'hello', { _type: 'post' }),
      page('post-es', 'hola', { _type: 'post', language: 'es' }),
      metadata('post', { en: 'post', es: 'post-es' }),
      { _id: 'settings', _type: 'settings', language: 'en' },
    ];

    expect(await linksOf(dataset, 'post')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/blog/hello' },
      { locale: 'en', href: 'https://staging.acme.test/blog' },
      { locale: 'es', href: 'https://staging.acme.test/es/blog/hola' },
      { locale: 'es', href: 'https://staging.acme.test/es/blog' },
    ]);
    expect(await linksOf(dataset, 'settings')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/' },
    ]);
  });

  test('links a field-level document to its page under every locale path', async () => {
    pluginConfig.translationLevel = 'internationalizedArray';
    pluginConfig.pageLinks = {
      ...config,
      locations: {
        post: {
          select: { slug: 'slug.current' },
          resolve: (value) => ({
            locations: [{ title: 'Post', href: `/blog/${value?.slug}` }],
          }),
        },
        home: { locations: [{ title: 'Home', href: '/' }] },
      },
    };
    const dataset = [
      page('pricing', 'pricing', { language: undefined }),
      page('post', 'hello', { _type: 'post', language: undefined }),
      { _id: 'home', _type: 'home' },
    ];

    expect(await linksOf(dataset, 'pricing')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/pricing' },
      { locale: 'es', href: 'https://staging.acme.test/es/pricing' },
    ]);
    expect(await linksOf(dataset, 'post')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/blog/hello' },
      { locale: 'es', href: 'https://staging.acme.test/es/blog/hello' },
    ]);
    expect(await linksOf(dataset, 'home')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/' },
      { locale: 'es', href: 'https://staging.acme.test/es' },
    ]);
  });

  test('queries per locale, not per document', async () => {
    pluginConfig.locales = ['es', 'fr'];
    const forms = Array.from({ length: 5 }, (_, index) => ({
      _id: `form${index}`,
      _type: 'gatedForm',
    }));
    const dataset = [
      ...forms,
      page('home', 'home', { forms: forms.map((form) => ref(form._id)) }),
    ];
    const { client, queries } = clientFor(dataset);

    const links = await collectPageLinks(
      forms as unknown as SanityDocument[],
      client
    );

    expect(links.get('form4')).toEqual([
      { locale: 'en', href: 'https://staging.acme.test/home' },
    ]);
    // sources, translations, then referrers for the source locale
    expect(queries).toHaveLength(3);
  });
});
