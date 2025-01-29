export {
  defaultBaseUrl,
  defaultCacheUrl,
  defaultRuntimeApiUrl
} from './settings/settingsUrls'
export {
  libraryDefaultLocale, 
  localeCookieName,
  localeHeaderName,
} from './settings/settings';
export {
  pluralForms,
  isAcceptedPluralForm
} from './settings/plurals'
import _getPluralForm from './locales/getPluralForm';
import { Content, JsxChild, JsxChildren, JsxElement } from './types';
export { _getPluralForm as getPluralForm, JsxChildren, Content, JsxChild, JsxElement };