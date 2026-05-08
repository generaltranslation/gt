import { I18nExternalStore } from './I18nExternalStore';

// One process-wide adapter mirrors the process-wide gt-i18n manager/condition
// store singletons. Tests can still instantiate I18nExternalStore directly.
let i18nExternalStore: I18nExternalStore | undefined;

export function getI18nExternalStore(): I18nExternalStore {
  i18nExternalStore ||= new I18nExternalStore();
  return i18nExternalStore;
}
