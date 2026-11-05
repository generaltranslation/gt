import { _formatMessageICU } from './formatting/format';
import {
  LocaleConfigBase,
  type LocaleConfigConstructorParams,
} from './LocaleConfigBase';

export type { LocaleConfigConstructorParams } from './LocaleConfigBase';

/**
 * LocaleConfig contains the locale and formatting primitives exposed through
 * the core entrypoint, including ICU message formatting.
 *
 * It intentionally does not store project IDs, API keys, runtime URLs, or any
 * translation credentials. It only stores locale metadata needed to resolve
 * aliases, choose formatting fallbacks, and format values with Intl.
 */
export class LocaleConfig extends LocaleConfigBase {
  constructor(params: LocaleConfigConstructorParams = {}) {
    super({ ...params, messageFormatter: _formatMessageICU });
  }
}
