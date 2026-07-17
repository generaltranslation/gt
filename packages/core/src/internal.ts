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
export { encode, decode } from './utils/base64';
export { isSupportedFileFormatTransform } from './utils/isSupportedFileFormatTransform';
export { API_VERSION } from './translate/api';

// derive
export { decodeVars } from './derive/decodeVars';
export { declareVar } from './derive/declareVar';
export { derive } from './derive/derive';
export { indexVars } from './derive/indexVars';
export { extractVars } from './derive/extractVars';
export { condenseVars } from './derive/condenseVars';
export { VAR_IDENTIFIER } from './derive/utils/constants';
export { traverseIcu } from './derive/utils/traverseIcu';
export { printIcuAst } from './derive/utils/printIcuAst';
