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
import _getPluralForm from './locales/getPluralForm';
import { defaultTimeout } from './settings/settings';
import type { _Content, JsxChild, JsxChildren, JsxElement } from './types';
import type { LocaleProperties } from './types';
import isVariable from './utils/isVariable';
import { minifyVariableType } from './utils/minify';
import { encode, decode } from './utils/base64';
import { isSupportedFileFormatTransform } from './utils/isSupportedFileFormatTransform';
import { validateFileFormatTransforms } from './translate/utils/validateFileFormatTransform';

export {
  _getPluralForm as getPluralForm,
  JsxChildren,
  _Content,
  JsxChild,
  JsxElement,
  LocaleProperties,
  isVariable,
  minifyVariableType,
  defaultTimeout,
  encode,
  decode,
  isSupportedFileFormatTransform,
  validateFileFormatTransforms,
};

// derive
export { decodeVars } from './derive/decodeVars';
export { declareVar } from './derive/declareVar';
export { derive } from './derive/derive';
export { indexVars } from './derive/indexVars';
export { extractVars } from './derive/extractVars';
export { condenseVars } from './derive/condenseVars';
export { VAR_IDENTIFIER, VAR_NAME_IDENTIFIER } from './derive/utils/constants';

// backwards compatability
export {
  getNewJsxChild,
  getNewJsxChildren,
  getNewJsxElement,
  getNewBranchType,
  getNewVariableType,
  getNewVariableObject,
  getNewGTProp,
  getOldJsxChild,
  getOldJsxChildren,
  getOldJsxElement,
  getOldBranchType,
  getOldVariableType,
  getOldVariableObject,
  getOldGTProp,
} from './backwards-compatability/dataConversion';
export type {
  OldJsxChild,
  OldJsxChildren,
  OldBranchType,
  OldJsxElement,
  OldVariableObject,
  OldVariableType,
  OldGTProp,
} from './backwards-compatability/oldTypes';
export {
  isOldVariableObject,
  isNewVariableObject,
  isOldJsxChildren,
} from './backwards-compatability/typeChecking';
export {
  oldHashJsxChildren,
  oldHashString,
} from './backwards-compatability/oldHashJsxChildren';
