import {
  getI18nConfig,
  ReadonlyConditionStore,
} from '@generaltranslation/react-core/pure';
import type { ReadonlyConditionStoreParams } from 'gt-i18n/internal';

/**
 * Keep server-rendered hook values identical to the browser's public aliases.
 */
export class ServerConditionStore extends ReadonlyConditionStore {
  constructor(params: ReadonlyConditionStoreParams) {
    super(params);
    // Resolve the alias once for this snapshot. The base constructor already
    // negotiated the supported locale; repeating that work is unnecessary.
    this.locale = getI18nConfig().resolveAliasLocale(this.locale);
  }
}
