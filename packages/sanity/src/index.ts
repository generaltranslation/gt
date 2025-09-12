import {
  baseDocumentLevelConfig,
  legacyDocumentLevelConfig as baseLegacyDocumentLevelConfig,
  baseFieldLevelConfig,
  Adapter,
  TranslationFunctionContext,
} from 'sanity-translations-tab';

export {
  findLatestDraft,
  BaseDocumentDeserializer,
  BaseDocumentSerializer,
  BaseDocumentMerger,
  defaultStopTypes,
  customSerializers,
  legacyDocumentLevelPatch,
  documentLevelPatch,
  fieldLevelPatch,
  TranslationsTab,
} from 'sanity-translations-tab';
import { GTAdapter } from './adapter';

interface ConfigOptions {
  adapter: Adapter;
  secretsNamespace: string | null;
  exportForTranslation: (
    id: string,
    context: TranslationFunctionContext
  ) => Promise<Record<string, any>>;
  importTranslation: (
    id: string,
    localeId: string,
    doc: string,
    context: TranslationFunctionContext
  ) => Promise<void>;
}

const defaultDocumentLevelConfig: ConfigOptions = {
  ...baseDocumentLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'gt',
};

const legacyDocumentLevelConfig: ConfigOptions = {
  ...baseLegacyDocumentLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'gt',
};

const defaultFieldLevelConfig: ConfigOptions = {
  ...baseFieldLevelConfig,
  adapter: GTAdapter,
  secretsNamespace: 'gt',
};

export {
  GTAdapter,
  defaultDocumentLevelConfig,
  defaultFieldLevelConfig,
  legacyDocumentLevelConfig,
};
