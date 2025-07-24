export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from './settings/settingsUrls';
export { libraryDefaultLocale } from './settings/settings';
export { pluralForms, isAcceptedPluralForm } from './settings/plurals';
import _getPluralForm from './locales/getPluralForm';
import { _Content, JsxChild, JsxChildren, JsxElement } from './types';
import { LocaleProperties } from './types';
import isVariable from './utils/isVariable';
import { minifyVariableType } from './utils/minify';
export {
  _getPluralForm as getPluralForm,
  JsxChildren,
  _Content,
  JsxChild,
  JsxElement,
  LocaleProperties,
  isVariable,
  minifyVariableType,
};

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
