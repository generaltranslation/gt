import { t as _t } from './deprecated/i18n-context/functions/translation/t';
import type { TemplateSyncResolutionFunction } from './deprecated/i18n-context/functions/translation/types';

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

export type { TemplateSyncResolutionFunction };
