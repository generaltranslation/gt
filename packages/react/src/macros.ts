import { t as _t } from './index.client';

type TemplateSyncResolutionFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;

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
