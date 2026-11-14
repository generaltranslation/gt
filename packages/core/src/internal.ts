export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultDashboardUrl,
  defaultRuntimeApiUrl,
} from './settings/settingsUrls';
export { defaultDefaultLocale } from './settings/settings';
// What a caller leaves out is resolved in this package and nowhere else, so
// the other General Translation packages format through these.
export { GTIntl } from './intl/GTIntl';
export {
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessage,
  formatMessageTree,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
} from './formatting/formatting';
export type { RuntimeTranslateManyOptions } from './types-dir/api/entry';
export { credentialScope } from './client/clientConfig';
export { isAcceptedPluralForm } from './settings/plurals';
export type {
  InjectionType,
  Transformation,
  TransformationPrefix,
  VariableTransformationSuffix,
} from './types-dir/transformations';
export {
  isUnstableGTHelperName,
  isUnstableGTImportSource,
  UNSTABLE_GT_HELPER_NAMES,
  type UnstableGTHelperName,
} from './settings/unstableImportSources';

export { getPluralForm } from './locales/getPluralForm';
export { isVariable } from './utils/isVariable';
export { minifyVariableType } from './utils/minify';
export { decode, encode } from './utils/base64';
export { isSupportedFileFormatTransform } from './utils/isSupportedFileFormatTransform';
export { supportedModelProviders } from './translate/modelProvider';

// derive
export { indexVars } from './derive/indexVars';
export { extractVars } from './derive/extractVars';
export { condenseVars } from './derive/condenseVars';
