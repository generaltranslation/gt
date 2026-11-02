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

/** A document whose pages count toward a source document's links. */
type Target = { sourceId: string; document: PageDocument };

const MAX_PAGES = 10;
const MAX_REFERENCE_DEPTH = 2;

const PUBLISHED = `!(_id in path("drafts.**")) && !(_id in path("versions.**"))`;

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

function addTo(map: Map<string, Set<string>>, key: string, value: string) {
  const values = map.get(key) ?? new Set<string>();
  values.add(value);
  map.set(key, values);
}

/**
 * Pages per source document in one locale: the target's own pages, then the pages of documents referencing it,
 * following referrers without a page of their own up to two levels.
 */
async function localePages(
  targets: Target[],
  locale: string,
  config: PageLinksConfig,
  projection: string,
  client: SanityClient
): Promise<Map<string, string[]>> {
  const languageField = pluginConfig.getLanguageField();
  const pages = new Map<string, string[]>();
  const seen = new Map<string, Set<string>>();
  let frontier = new Map<string, Set<string>>();
  for (const { sourceId, document } of targets) {
    pages.set(sourceId, documentPages(document, locale, config));
    seen.set(sourceId, new Set([document._id]));
    addTo(frontier, document._id, sourceId);
  }

  for (
    let depth = 0;
    depth < MAX_REFERENCE_DEPTH && frontier.size > 0;
    depth++
  ) {
    const rows = await client.fetch<
      { _id: string; referrers: PageDocument[] }[]
    >(
      `*[_id in $ids]{
        _id,
        'referrers': *[
          references(^._id) && ${PUBLISHED} &&
          _type != '${TRANSLATION_METADATA_TYPE}' &&
          (!defined(${languageField}) || ${languageField} == $locale)
        ] | order(_id asc) [0...${MAX_PAGES}] ${projection}
      }`,
      { ids: [...frontier.keys()], locale }
    );
    const next = new Map<string, Set<string>>();
    for (const { _id, referrers } of rows) {
      for (const sourceId of frontier.get(_id) ?? []) {
        for (const referrer of referrers) {
          const visited = seen.get(sourceId)!;
          if (visited.has(referrer._id)) continue;
          visited.add(referrer._id);
          const own = documentPages(referrer, locale, config);
          if (own.length > 0) pages.get(sourceId)!.push(...own);
          else addTo(next, referrer._id, sourceId);
        }
      }
    }
    frontier = next;
  }

  return new Map(
    [...pages].map(([sourceId, hrefs]) => [
      sourceId,
      [...new Set(hrefs)].slice(0, MAX_PAGES),
    ])
  );
}

/** Published translations of document-level originals per locale, read from `translation.metadata`. */
async function translatedTargets(
  sourceIds: string[],
  locales: string[],
  projection: string,
  client: SanityClient
): Promise<Map<string, Target[]>> {
  if (sourceIds.length === 0) return new Map();
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
  const targets = new Map<string, Target[]>();
  for (const { sourceId, translations } of rows) {
    for (const { language, document } of translations) {
      if (document && document._id !== sourceId) {
        targets.set(language, [
          ...(targets.get(language) ?? []),
          { sourceId, document },
        ]);
      }
    }
  }
  return targets;
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

  const projection = documentProjection(config);
  const sourceLocale = pluginConfig.getSourceLocale();
  const locales = [...new Set([sourceLocale, ...pluginConfig.getLocales()])];
  const sources = await client.fetch<PageDocument[]>(
    `*[_id in $ids]${projection}`,
    { ids: documents.map(getDocumentPublishedId) }
  );
  const languageById = new Map(
    documents.map((document) => [
      getDocumentPublishedId(document),
      allowsNonDefaultSourceLocales()
        ? getDocumentLanguage(document)
        : sourceLocale,
    ])
  );

  const targetsByLocale = new Map<string, Target[]>(
    locales.map((locale) => [locale, []])
  );
  const addTarget = (locale: string, target: Target) =>
    targetsByLocale.set(locale, [
      ...(targetsByLocale.get(locale) ?? []),
      target,
    ]);
  const documentLevelIds: string[] = [];
  for (const document of sources) {
    const target = { sourceId: document._id, document };
    if (
      getTranslationStrategyForType(document._type).level ===
      'internationalizedArray'
    ) {
      for (const locale of locales) addTarget(locale, target);
    } else {
      addTarget(languageById.get(document._id) ?? sourceLocale, target);
      documentLevelIds.push(document._id);
    }
  }
  const translated = await translatedTargets(
    documentLevelIds,
    locales,
    projection,
    client
  );
  for (const [locale, targets] of translated) {
    for (const target of targets) addTarget(locale, target);
  }

  const localeEntries = [...targetsByLocale];
  const pagesByLocale = await Promise.all(
    localeEntries.map(([locale, targets]) =>
      localePages(targets, locale, config, projection, client)
    )
  );

  const links = new Map<string, PageLink[]>();
  localeEntries.forEach(([locale], index) => {
    for (const [sourceId, hrefs] of pagesByLocale[index]!) {
      const pages = hrefs.map((href) => ({ locale, href }));
      const existing = links.get(sourceId) ?? [];
      links.set(
        sourceId,
        locale === languageById.get(sourceId)
          ? [...pages, ...existing]
          : [...existing, ...pages]
      );
    }
  });
  return links;
}
