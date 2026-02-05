import { I18nManager as I18nManagerBase } from 'gt-i18n/internal';
import { AsyncStorageAdapter } from './AsyncStorageAdapter';
import { I18nManagerConstructorParams } from 'gt-i18n/types';

export class I18nManager extends I18nManagerBase {
  constructor(config: I18nManagerConstructorParams<AsyncStorageAdapter>) {
    super(config);
  }
}
