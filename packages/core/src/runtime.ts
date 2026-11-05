import {
  LocaleConfig,
  type LocaleConfigConstructorParams,
} from '@generaltranslation/format';
import { GTRuntimeBase } from './runtimeBase';

export type { GTConstructorParams } from './runtimeBase';

/**
 * GTRuntime is the runtime core of the GT driver: locale management,
 * formatting, and runtime translation requests.
 *
 * Browser-facing SDK code constructs this class (via `generaltranslation/runtime`)
 * so production bundles do not ship the project/file management API client
 * that lives on the GT class exported from the main entry.
 *
 * @example
 * const gt = new GTRuntime({
 *   sourceLocale: 'en-US',
 *   targetLocale: 'es-ES',
 *   locales: ['en-US', 'es-ES', 'fr-FR']
 * });
 */
export class GTRuntime extends GTRuntimeBase {
  protected createLocaleConfig(
    params: LocaleConfigConstructorParams
  ): LocaleConfig {
    return new LocaleConfig(params);
  }
}
