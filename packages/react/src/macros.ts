import { t as _t, type TemplateSyncResolutionFunction } from 'gt-i18n';

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
