export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultRuntimeApiUrl,
} from './settings/settingsUrls';
export { libraryDefaultLocale } from './settings/settings';
export { pluralForms, isAcceptedPluralForm } from './settings/plurals';
import _getPluralForm from './locales/getPluralForm';
import { Content, JsxChild, JsxChildren, JsxElement } from './types';
import { LocaleProperties } from './types';
import isVariable from './utils/isVariable';
import { minifyVariableType } from './utils/minify';
export {
  _getPluralForm as getPluralForm,
  JsxChildren,
  Content,
  JsxChild,
  JsxElement,
  LocaleProperties,
  isVariable,
  minifyVariableType,
};
