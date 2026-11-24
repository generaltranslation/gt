import { lookupCachedTranslation, type CreateGTParams } from 'gt-i18n/internal';
import { lookupGlobalSnapshotTranslation } from '../../translations-snapshot/lookupGlobalSnapshotTranslation';

/**
 * Production SPAs create no i18nCache, so t() and m() read the global
 * translations snapshot there and the I18nCache elsewhere.
 */
export const lookupSpaTranslation: CreateGTParams['lookupTranslation'] =
  process.env.NODE_ENV === 'production'
    ? lookupGlobalSnapshotTranslation
    : lookupCachedTranslation;
