import type { PortableTextHtmlComponents } from '@portabletext/to-html';
import { getLocaleProperties } from 'generaltranslation';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { definePlugin } from 'sanity';
import { route } from 'sanity/router';
import { translateAction } from './actions/translateAction';
import { gt, pluginConfig } from './adapter/core';
import type {
  DedupeFields,
  IgnoreFields,
  SkipFields,
  TranslateDocumentFilter,
  FieldLevelTranslationMode,
} from './adapter/types';
import {
  createInternationalizedArrayTypes,
  resolveFieldLevelConfig,
} from './schema/createInternationalizedArrayTypes';
import type { GTFieldLevelLocalizationConfig } from './schema/types';
import TranslationsTool from './components/page/TranslationsTool';
import { documentInternationalization } from './documentInternationalization';
import type { CustomDeserializers } from './serialization/types';
import { SECRETS_NAMESPACE } from './utils/shared';

// ===== Document Internationalization ===== //
export {
  useDocumentInternationalizationContext,
  DocumentInternationalizationMenu,
  useDeleteTranslationAction,
  useDuplicateWithTranslationsAction,
} from './documentInternationalization';
export { documentInternationalization };
export type {
  DocumentInternationalizationConfig,
  Language,
  Metadata,
  TranslationReference,
} from './documentInternationalization';

// ===== Serialization Helpers ===== //
export { default as TranslationsTab } from './components/tab/TranslationsTab';
export { findLatestDraft } from './configuration/utils/findLatestDraft';
export { BaseDocumentSerializer } from './serialization/serialize/index';
export { BaseDocumentDeserializer } from './serialization/deserialize/BaseDocumentDeserializer';
export { BaseDocumentMerger } from './serialization/BaseDocumentMerger';
export {
  defaultStopTypes,
  customSerializers,
} from './serialization/BaseSerializationConfig';
export { attachGTData, detachGTData } from './serialization/data';
export { translateAction };
export type {
  Secrets,
  Adapter,
  ExportForTranslation,
  ImportTranslation,
  TranslationFunctionContext,
  TranslationsTabConfigOptions,
} from './types';
export type { SerializedDocument } from './serialization/types';

// ===== Field-Level (Internationalized Array) Localization ===== //
export { createInternationalizedArrayTypes };
export type {
  GTFieldLevelLocalizationConfig,
  FieldLevelFieldType,
} from './schema/types';
export type { FieldLevelTranslationMode };

export type GTPluginConfig = Omit<
  Parameters<typeof gt.setConfig>[0],
  'locales'
> & {
  locales: string[];
  // Alias for sourceLocale — accepted so users can spread gt.config.json directly.
  defaultLocale?: string;
  singletons?: string[];
  // Optional mapping function to map source document ids to translated singleton document ids
  // By default, the translated singleton document is is `${sourceDocumentId}-${locale}`
  singletonMapping?: (sourceDocumentId: string, locale: string) => string;
  ignoreFields?: IgnoreFields[];
  dedupeFields?: DedupeFields[];
  skipFields?: SkipFields[];
  languageField?: string;
  translateDocuments?: TranslateDocumentFilter[] | string[];
  secretsNamespace?: string;
  additionalStopTypes?: string[];
  additionalSerializers?: Partial<PortableTextHtmlComponents>;
  additionalDeserializers?: CustomDeserializers;
  additionalBlockDeserializers?: unknown[];
  // When true (default), automatically adds the @sanity/document-internationalization plugin
  // with language badges, translation menu, and per-language templates.
  // Requires translateDocuments to specify which document types to enable translations for.
  showDocumentInternationalization?: boolean;
  // Field-level (internationalized-array) localization. Generates
  // `internationalizedArray*` schema types + input components when enabled.
  // `fieldLevelLocalization` is a descriptive alias for the same config.
  internationalizedArray?: GTFieldLevelLocalizationConfig;
  fieldLevelLocalization?: GTFieldLevelLocalizationConfig;
  // How matched documents are translated. Independent from schema generation:
  // enabling `internationalizedArray` only adds editable fields; routing
  // translation through the array path requires opting in here. Default 'document'.
  translationLevel?: FieldLevelTranslationMode;
  // In 'mixed' mode, the document types that use the internationalized-array
  // strategy; everything else stays document-level.
  fieldLevelDocuments?: TranslateDocumentFilter[] | string[];
};

/**
 * Usage in `sanity.config.ts` (or .js)
 *
 * ```ts
 * import {defineConfig} from 'sanity'
 * import {gtPlugin} from 'gt-sanity'
 *
 * export default defineConfig({
 *   // ...
 *   plugins: [gtPlugin()],
 * })
 * ```
 */
export const gtPlugin = definePlugin<GTPluginConfig>(
  ({
    languageField = 'language',
    sourceLocale,
    defaultLocale,
    locales,
    customMapping,
    apiKey,
    projectId,
    singletons,
    singletonMapping,
    ignoreFields,
    dedupeFields,
    skipFields,
    translateDocuments,
    secretsNamespace = SECRETS_NAMESPACE,
    additionalStopTypes = [],
    additionalSerializers = {},
    additionalDeserializers = {},
    additionalBlockDeserializers = [],
    showDocumentInternationalization = true,
    internationalizedArray,
    fieldLevelLocalization,
    translationLevel = 'document',
    fieldLevelDocuments,
  }) => {
    // Resolve sourceLocale: explicit sourceLocale > defaultLocale (from gt.config.json) > library default
    const resolvedSourceLocale =
      sourceLocale ?? defaultLocale ?? libraryDefaultLocale;

    // Normalize translateDocuments: string[] → TranslateDocumentFilter[]
    const normalizeFilters = (
      entries: (TranslateDocumentFilter | string)[] | undefined
    ): TranslateDocumentFilter[] | undefined =>
      entries
        ?.map((entry) => (typeof entry === 'string' ? { type: entry } : entry))
        .filter((filter) => filter.documentId || filter.type);

    const normalizedTranslateDocuments = normalizeFilters(translateDocuments);
    const normalizedFieldLevelDocuments =
      normalizeFilters(fieldLevelDocuments) ?? [];

    // `internationalizedArray` and `fieldLevelLocalization` are aliases.
    const fieldLevelConfig = resolveFieldLevelConfig(
      internationalizedArray ?? fieldLevelLocalization
    );

    pluginConfig.init(
      secretsNamespace,
      languageField,
      resolvedSourceLocale,
      locales,
      singletons || [],
      // singletons is a string array of singleton document ids
      singletonMapping ||
        ((sourceDocumentId, locale) => `${sourceDocumentId}-${locale}`),
      ignoreFields || [],
      dedupeFields || [],
      skipFields || [],
      normalizedTranslateDocuments || [],
      additionalStopTypes,
      additionalSerializers,
      additionalDeserializers,
      additionalBlockDeserializers,
      translationLevel,
      normalizedFieldLevelDocuments
    );
    gt.setConfig({
      sourceLocale: resolvedSourceLocale,
      customMapping: customMapping,
      apiKey: apiKey,
      projectId: projectId,
    });

    // Document types localized in place via internationalized arrays must NOT
    // get @sanity/document-internationalization (language badges + per-locale
    // documents). Build the set of array-localized types from translationLevel.
    const arrayLocalizedTypes = new Set<string>();
    if (translationLevel === 'internationalizedArray') {
      normalizedTranslateDocuments
        ?.map((filter) => filter.type)
        .filter((type): type is string => !!type)
        .forEach((type) => arrayLocalizedTypes.add(type));
    } else if (translationLevel === 'mixed') {
      normalizedFieldLevelDocuments
        .map((filter) => filter.type)
        .filter((type): type is string => !!type)
        .forEach((type) => arrayLocalizedTypes.add(type));
    }

    // Auto-add document internationalization plugin
    const plugins = [];
    if (showDocumentInternationalization) {
      const schemaTypes =
        normalizedTranslateDocuments
          ?.map((filter) => filter.type)
          .filter((type): type is string => !!type)
          .filter((type) => !arrayLocalizedTypes.has(type)) ?? [];
      if (schemaTypes.length > 0) {
        const allLocales = [resolvedSourceLocale, ...locales];
        const supportedLanguages = allLocales.map((locale) => {
          const props = getLocaleProperties(locale, resolvedSourceLocale);
          return { id: locale, title: props.name };
        });
        plugins.push(
          documentInternationalization({
            supportedLanguages,
            schemaTypes,
            languageField,
          })
        );
      }
    }

    const schemaTypes = fieldLevelConfig.enabled
      ? createInternationalizedArrayTypes({
          sourceLocale: resolvedSourceLocale,
          locales,
          fieldTypes: fieldLevelConfig.fieldTypes,
          languageTitles: fieldLevelConfig.languageTitles,
          getLanguageTitle: fieldLevelConfig.getLanguageTitle,
          typePrefix: fieldLevelConfig.typePrefix,
          includeCompatibilityTypes: fieldLevelConfig.includeCompatibilityTypes,
        })
      : [];

    return {
      name: 'gt-sanity',
      plugins,
      schema: {
        types: schemaTypes,
      },
      tools: [
        {
          name: 'translations',
          title: 'Translations',
          component: TranslationsTool,
          router: route.create('/*'),
        },
      ],
      document: {
        actions: (prev) => {
          return [...prev, translateAction];
        },
      },
    };
  }
);
