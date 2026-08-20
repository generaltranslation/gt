import { getLocaleProperties } from 'generaltranslation';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type {
  ListItemBuilder,
  StructureBuilder,
  StructureResolver,
  StructureResolverContext,
} from 'sanity/structure';
import { pluginConfig } from '../adapter/core';
import { formatLocalePropertiesLabel } from '../utils/localeDisplay';
import { SANITY_API_VERSION } from '../utils/shared';

export type GTStructureOptions = {
  /**
   * Document types to group by locale. Defaults to the types in
   * `translateDocuments` that are translated into per-locale documents.
   */
  types?: string[];
  /** Title of the pane holding the source-locale documents. */
  sourceTitle?: string;
  /** Title of a locale's pane. Defaults to `<Type> in <Locale>`. */
  localeTitle?: (typeTitle: string, locale: string, label: string) => string;
};

/**
 * Document types translated into per-locale documents.
 *
 * Types localized through internationalized arrays are excluded: their
 * translations live inside the source document, so there is no per-locale
 * document to group.
 */
function documentLevelTypes(): string[] {
  const level = pluginConfig.getTranslationLevel();
  const types = pluginConfig
    .getTranslateDocuments()
    .map((filter) => filter.type)
    .filter((type): type is string => Boolean(type));

  if (level === 'internationalizedArray') return [];
  if (level === 'mixed') {
    const fieldLevel = new Set(
      pluginConfig.getFieldLevelDocuments().map((filter) => filter.type)
    );
    return types.filter((type) => !fieldLevel.has(type));
  }
  return types;
}

function localeLabel(locale: string): string {
  const sourceLocale = pluginConfig.getSourceLocale();
  return formatLocalePropertiesLabel(
    locale,
    getLocaleProperties(locale, sourceLocale)
  );
}

function typeTitle(type: string, context?: StructureResolverContext): string {
  const schemaType = context?.schema?.get(type);
  return (schemaType?.title as string | undefined) ?? type;
}

/**
 * Builds one list item per translatable document type. Each expands into a
 * pane per locale, so translations are browsed by language instead of sitting
 * alongside their source in a single flat list.
 *
 * Returns an empty array when `translateDocuments` names no types, since the
 * grouping is per type.
 */
export function gtStructureItems(
  S: StructureBuilder,
  context?: StructureResolverContext,
  options: GTStructureOptions = {}
): ListItemBuilder[] {
  const types = options.types ?? documentLevelTypes();

  if (types.length === 0) {
    console.warn(
      createDiagnosticMessage({
        source: 'gt-sanity',
        severity: 'Warning',
        whatHappened: 'No document types to group by locale',
        why: 'the structure helper groups per document type, and none were resolved from the plugin configuration',
        fix: 'List the types in `translateDocuments`, or pass them to the structure helper as `types`',
      })
    );
    return [];
  }

  const sourceLocale = pluginConfig.getSourceLocale();
  const languageField = pluginConfig.getLanguageField();
  const targetLocales = pluginConfig.getLocales();
  const titleFor =
    options.localeTitle ??
    ((title: string, _locale: string, label: string) => `${title} in ${label}`);

  return types.map((type) => {
    const title = typeTitle(type, context);

    // A document with no language field is the source: the plugin only
    // stamps the field on translations it creates, and existing content
    // predates the plugin.
    const sourceFilter = `_type == $type && (!defined(${languageField}) || ${languageField} == $locale)`;
    const localeFilter = `_type == $type && ${languageField} == $locale`;

    return S.listItem()
      .id(`gt-${type}`)
      .title(title)
      .child(
        S.list()
          .id(`gt-${type}-locales`)
          .title(title)
          .items([
            S.listItem()
              .id(`gt-${type}-${sourceLocale}`)
              .title(options.sourceTitle ?? localeLabel(sourceLocale))
              .child(
                S.documentList()
                  .id(`gt-${type}-${sourceLocale}-list`)
                  .title(options.sourceTitle ?? localeLabel(sourceLocale))
                  .schemaType(type)
                  .apiVersion(SANITY_API_VERSION)
                  .filter(sourceFilter)
                  .params({ type, locale: sourceLocale })
              ),
            S.divider(),
            ...targetLocales.map((locale) => {
              const paneTitle = titleFor(title, locale, localeLabel(locale));
              return S.listItem()
                .id(`gt-${type}-${locale}`)
                .title(paneTitle)
                .child(
                  S.documentList()
                    .id(`gt-${type}-${locale}-list`)
                    .title(paneTitle)
                    .schemaType(type)
                    .apiVersion(SANITY_API_VERSION)
                    .filter(localeFilter)
                    .params({ type, locale })
                );
            }),
          ])
      );
  });
}

/**
 * A ready-made structure that lists every translatable type grouped by locale.
 *
 * Use `gtStructureItems` instead to place these alongside other list items.
 */
export function gtStructure(
  options: GTStructureOptions = {}
): StructureResolver {
  return (S, context) =>
    S.list()
      .title('Content')
      .items(gtStructureItems(S, context, options));
}
