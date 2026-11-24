export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultDashboardUrl,
  defaultRuntimeApiUrl,
} from './settings/settingsUrls';
// What a caller leaves out is resolved in this package and nowhere else, so
// the other General Translation packages format through these.
export { GTIntl } from './intl/GTIntl';
export { LocaleIntl } from './intl/LocaleIntl';
export {
  formatCurrency,
  formatCutoff,
  formatDateTime,
  formatList,
  formatListToParts,
  formatMessageTree,
  formatNum,
  formatRelativeTime,
  formatRelativeTimeFromDate,
  withDefaultDateStyle,
} from './formatting/formatting';
export { formatMessage } from './formatting/formatMessage';
export type { RuntimeTranslateManyOptions } from './types-dir/api/entry';
export { credentialScope } from './client/clientConfig';
export {
  credentialEnvNames,
  resolveCredentials,
  type CredentialsEnv,
  type ResolvedCredentials,
} from './config/credentials';
export { getPluralBranchKey, isAcceptedPluralForm } from './settings/plurals';
export {
  isGTMessageHelperName,
  isGTMessageImportSource,
  GT_MESSAGE_HELPER_NAMES,
  type GTMessageHelperName,
} from './settings/messageImportSources';

export { getPluralForm } from './locales/getPluralForm';
export { isVariable } from './utils/isVariable';
export { minifyVariableType } from './utils/minify';
export { decode, encode } from './utils/base64';
export { isSupportedFileFormatTransform } from './utils/isSupportedFileFormatTransform';

// derive
export { declareVar } from './derive/declareVar';
export { indexVars } from './derive/indexVars';
