export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from './settings/settingsUrls';
export { libraryDefaultLocale } from './settings/settings';
export type { RuntimeTranslateManyOptions } from './types-dir/api/entry';
export { credentialScope } from './clientConfig';
export { isAcceptedPluralForm } from './settings/plurals';

export { _getPluralForm as getPluralForm } from './locales/getPluralForm';
export { isVariable } from './utils/isVariable';
export { minifyVariableType } from './utils/minify';
export { decode, encode } from './utils/base64';
export { isSupportedFileFormatTransform } from './utils/isSupportedFileFormatTransform';
export {
  isModelProvider,
  supportedModelProviders,
} from './translate/modelProvider';
export type { ModelProvider } from './translate/modelProvider';

// derive
export { indexVars } from './derive/indexVars';
export { extractVars } from './derive/extractVars';
export { condenseVars } from './derive/condenseVars';
export { VAR_IDENTIFIER } from './derive/utils/constants';
