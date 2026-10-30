export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from './settings/settingsUrls';
export {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from './logging/diagnostics';
export type {
  DiagnosticMessageInput,
  DiagnosticSeverity,
} from './logging/diagnostics';
export { libraryDefaultLocale } from './settings/settings';
export type { RuntimeTranslateManyOptions } from './types-dir/api/entry';
export { pluralForms, isAcceptedPluralForm } from './settings/plurals';

export { _getPluralForm as getPluralForm } from './locales/getPluralForm';
export type {
  JsxChildren,
  JsxChild,
  JsxElement,
  LocaleProperties,
} from './types';
export { isVariable } from './utils/isVariable';
export { minifyVariableType } from './utils/minify';
export {
  decode,
  decodeFileContent,
  encode,
  encodeFileContent,
} from './utils/base64';
export { isSupportedFileFormatTransform } from './utils/isSupportedFileFormatTransform';
export { API_VERSION } from '@generaltranslation/api';
export {
  isErrorResult,
  unwrapApiResult,
} from './translate/utils/unwrapApiResult';
export { createGtApiAdapter } from './adapter/createGtApi';
export type { GtApiAdapter, GtApiAdapterConfig } from './adapter/createGtApi';
export {
  isModelProvider,
  supportedModelProviders,
} from './adapter/modelProvider';
export type { ModelProvider } from './adapter/modelProvider';

// derive
export { decodeVars } from './derive/decodeVars';
export { declareVar } from './derive/declareVar';
export { derive } from './derive/derive';
export { indexVars } from './derive/indexVars';
export { extractVars } from './derive/extractVars';
export { condenseVars } from './derive/condenseVars';
export { VAR_IDENTIFIER } from './derive/utils/constants';

// locale twins
export {
  DEFAULT_TRANSLATION_SPLITTING,
  LOCALE_TWINS_SPLITTING,
  LOCALE_TWIN_MANIFEST_FILE,
  LOCALE_TWIN_MANIFEST_VERSION,
  LOCALE_TWIN_PLACEHOLDER_PREFIX,
  TRANSLATION_SPLITTING_STRATEGIES,
} from './locale-twins/constants';
export {
  isLocaleTwinsSplitting,
  isTranslationSplittingStrategy,
  resolveTranslationSplitting,
  resolveTranslationSplittingValue,
} from './locale-twins/splitting';
export {
  decodeLocaleTwinPlaceholder,
  encodeLocaleTwinPlaceholder,
  findLocaleTwinPlaceholders,
  isUnfilledLocaleTwinPlaceholder,
} from './locale-twins/placeholder';
export type {
  LocaleTwinEntries,
  LocaleTwinPlaceholderMatch,
} from './locale-twins/placeholder';
export {
  parseLocaleTwinTable,
  serializeLocaleTwinTable,
} from './locale-twins/table';
export type { LocaleTwinTable } from './locale-twins/table';
export { parseLocaleTwinManifest } from './locale-twins/manifest';
export type { LocaleTwinManifest } from './locale-twins/manifest';
