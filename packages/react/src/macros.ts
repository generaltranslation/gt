import { t as _t } from './i18n-context/functions/translation/t';
import { TemplateSyncResolutionFunction } from './i18n-context/functions/translation/types';

declare global {
  /**
   * Translate a message
   *
   * @example
   * import 'gt-react/macros';
   *
   * t`Hello, world!`; // "Bonjour, le monde!"
   * t`Hello, ${name}!`; // "Bonjour, Alice!"
   */
  var t: TemplateSyncResolutionFunction;
}

globalThis.t = _t;

export { TemplateSyncResolutionFunction };
