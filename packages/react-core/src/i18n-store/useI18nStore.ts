import { useGTContext } from '../context/context';
import { I18nStore } from './I18nStore';
import { getI18nStore } from './singleton-operations';
import {
  getGlobalTranslationsSnapshot,
  isGlobalTranslationsSnapshotInitialized,
  type TranslationsSnapshot,
} from '../translations-snapshot/singleton-operations';

// One object, so hooks that depend on the snapshot keep what they memoized.
const NO_TRANSLATIONS: TranslationsSnapshot = Object.freeze({});

export function useI18nStore(): I18nStore {
  const context = useGTContext();
  return context?.i18nStore || getI18nStore();
}

export function useTranslationsSnapshot(): TranslationsSnapshot {
  const context = useGTContext();
  if (context?.translationsSnapshot) {
    return context.translationsSnapshot;
  } else if (isGlobalTranslationsSnapshotInitialized()) {
    return getGlobalTranslationsSnapshot();
  } else {
    return NO_TRANSLATIONS;
  }
}
