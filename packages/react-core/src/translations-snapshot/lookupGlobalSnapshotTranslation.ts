import type { CreateGTParams } from 'gt-i18n/internal';
import { lookupTranslation } from '../i18n-store/utils/translations';
import {
  getGlobalTranslationsSnapshot,
  isGlobalTranslationsSnapshotInitialized,
} from './singleton-operations';

/** Reads the global translations snapshot, which production clients load. */
export const lookupGlobalSnapshotTranslation: CreateGTParams['lookupTranslation'] =
  (tree, options) =>
    isGlobalTranslationsSnapshotInitialized()
      ? lookupTranslation(getGlobalTranslationsSnapshot(), {
          locale: options.$locale,
          content: tree,
          options,
        })
      : undefined;
