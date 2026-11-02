import type { SanityClient, SanityDocument } from 'sanity';
import type {
  DocumentLocationResolvers,
  DocumentLocationsState,
} from 'sanity/presentation';
import { pluginConfig } from '../adapter/core';
import type { PageLink } from '../serialization/types';
import { getDocumentPublishedId } from '../utils/documentIds';
import {
  metadataTranslationRef,
  metadataTranslations,
  TRANSLATION_METADATA_TYPE,
} from '../utils/translationMetadata';
import {
  allowsNonDefaultSourceLocales,
  getDocumentLanguage,
  GROUP_ORIGINAL_REF,
} from '../utils/translationSource';
import { getTranslationStrategyForType } from './strategy';

export type PageLinksConfig = {
  /** Origin of the site the documents are shown on, e.g. `https://staging.example.com`. */
  baseUrl: string;
  /** Path prefix for a locale's pages. Defaults to none for the source locale and `/<locale>` otherwise. */
  localePath?: (locale: string) => string;
  /** The `locations` given to `presentationTool({ resolve })`, with paths within a locale; types without one link to `slug.current`. */
  locations?: DocumentLocationResolvers;
};

type PageDocument = {
  _id: string;
  _type: string;
  slug?: string | null;
  location?: Record<string, unknown> | null;
};

/** A document whose pages are a source document's links in one locale. */
type Target = { locale: string; sourceId: string; document: PageDocument };

const MAX_PAGES = 10;

/** One projection for every query, selecting each resolver's fields by type. */
function documentProjection(config: PageLinksConfig): string {
  const selects = Object.entries(config.locations ?? {}).flatMap(
    ([type, resolver]) =>
      'resolve' in resolver
        ? [
            `_type == ${JSON.stringify(type)} => { ${Object.entries(
              resolver.select
            )
              .map(([name, path]) => `${JSON.stringify(name)}: ${path}`)
              .join(', ')} }`,
          ]
        : []
  );
  const location =
    selects.length > 0 ? `, 'location': select(${selects.join(', ')})` : '';
  return `{ _id, _type, 'slug': slug.current${location} }`;
}

function localizedUrl(
  path: string,
  locale: string,
  config: PageLinksConfig
): string {
  const localePath = config.localePath
    ? config.localePath(locale)
    : locale === pluginConfig.getSourceLocale()
      ? ''
      : `/${locale}`;
  const localized =
    path === '/' && localePath ? localePath : `${localePath}${path}`;
  return new URL(path.startsWith('/') ? localized : path, config.baseUrl).href;
}

function documentPages(
  document: PageDocument,
  locale: string,
  config: PageLinksConfig
): string[] {
  const resolver = config.locations?.[document._type];
  if (!resolver) {
    return document.slug
      ? [localizedUrl(`/${document.slug.replace(/^\/+/, '')}`, locale, config)]
      : [];
  }
  const state: DocumentLocationsState | undefined =
    'resolve' in resolver
      ? resolver.resolve(document.location ?? null) || undefined
      : resolver;
  return (state?.locations ?? []).map(({ href }) =>
    localizedUrl(href, locale, config)
  );
}

/** Each target's pages in one locale: its own, then those of the documents referencing it. */
async function localePages(
  locale: string,
  targets: Target[],
  config: PageLinksConfig,
  projection: string,
  client: SanityClient
): Promise<string[][]> {
  const languageField = pluginConfig.getLanguageField();
  const rows = await client.fetch<{ _id: string; referrers: PageDocument[] }[]>(
    `*[_id in $ids]{
      _id,
      'referrers': *[
        references(^._id) &&
        _type != '${TRANSLATION_METADATA_TYPE}' &&
        (!defined(${languageField}) || ${languageField} == $locale)
      ] | order(_id asc) [0...${MAX_PAGES}] ${projection}
    }`,
    { ids: targets.map(({ document }) => document._id), locale }
  );
  const referrers = new Map(rows.map((row) => [row._id, row.referrers]));
  return targets.map(({ document }) => {
    const hrefs = [document, ...(referrers.get(document._id) ?? [])].flatMap(
      (shown) => documentPages(shown, locale, config)
    );
    return [...new Set(hrefs)].slice(0, MAX_PAGES);
  });
}

/** Published translations of document-level originals, read from `translation.metadata`. */
async function translatedTargets(
  sourceIds: string[],
  locales: string[],
  projection: string,
  client: SanityClient
): Promise<Target[]> {
  if (sourceIds.length === 0) return [];
  const originalRef = allowsNonDefaultSourceLocales()
    ? GROUP_ORIGINAL_REF
    : metadataTranslationRef('$sourceLocale');
  const rows = await client.fetch<
    {
      sourceId: string;
      translations: { language: string; document: PageDocument | null }[];
    }[]
  >(
    `*[
      _type == '${TRANSLATION_METADATA_TYPE}' &&
      ${originalRef} in $sourceIds
    ] {
      'sourceId': ${originalRef},
      'translations': ${metadataTranslations('in $locales', 'defined(value._ref)')}{
        language,
        'document': value->${projection}
      }
    }`,
    { sourceLocale: pluginConfig.getSourceLocale(), sourceIds, locales }
  );
  return rows.flatMap(({ sourceId, translations }) =>
    translations.flatMap(({ language, document }) =>
      document && document._id !== sourceId
        ? [{ locale: language, sourceId, document }]
        : []
    )
  );
}

/**
 * Page links per published source document id when the plugin is configured with `pageLinks`: the original's locale
 * first, then each other locale with a published translation. A field-level document is its own page in every locale.
 */
export async function collectPageLinks(
  documents: SanityDocument[],
  client: SanityClient
): Promise<Map<string, PageLink[]>> {
  const config = pluginConfig.getPageLinks();
  if (!config || documents.length === 0) return new Map();
  const published = client.withConfig({ perspective: 'published' });

  const projection = documentProjection(config);
  const sourceLocale = pluginConfig.getSourceLocale();
  const locales = [...new Set([sourceLocale, ...pluginConfig.getLocales()])];
  const languageById = new Map(
    documents.map((document) => [
      getDocumentPublishedId(document),
      allowsNonDefaultSourceLocales()
        ? getDocumentLanguage(document)
        : sourceLocale,
    ])
  );
  const sources = await published.fetch<PageDocument[]>(
    `*[_id in $ids]${projection}`,
    { ids: [...languageById.keys()] }
  );

  const fieldLevel = (document: PageDocument) =>
    getTranslationStrategyForType(document._type).level ===
    'internationalizedArray';
  const originals = sources.flatMap((document): Target[] =>
    fieldLevel(document)
      ? locales.map((locale) => ({ locale, sourceId: document._id, document }))
      : [
          {
            locale: languageById.get(document._id) ?? sourceLocale,
            sourceId: document._id,
            document,
          },
        ]
  );
  const targets = [
    ...originals,
    ...(await translatedTargets(
      sources
        .filter((document) => !fieldLevel(document))
        .map((document) => document._id),
      locales,
      projection,
      published
    )),
  ];

  const pages = new Map<Target, string[]>();
  await Promise.all(
    [...new Set(targets.map(({ locale }) => locale))].map(async (locale) => {
      const inLocale = targets.filter((target) => target.locale === locale);
      const hrefs = await localePages(
        locale,
        inLocale,
        config,
        projection,
        published
      );
      inLocale.forEach((target, index) => pages.set(target, hrefs[index]!));
    })
  );

  const links = new Map<string, PageLink[]>();
  for (const target of targets) {
    links.set(target.sourceId, [
      ...(links.get(target.sourceId) ?? []),
      ...(pages.get(target) ?? []).map((href) => ({
        locale: target.locale,
        href,
      })),
    ]);
  }
  return links;
}
