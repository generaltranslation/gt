import type { GT } from 'generaltranslation';

// A Payload document or part of one, as the Local API returns it.
export type Data = Record<string, unknown>;

// The GT SDK calls the plugin makes.
export type GtClient = Pick<
  GT,
  | 'uploadSourceFiles'
  | 'enqueueFiles'
  | 'awaitJobs'
  | 'downloadFileBatch'
  | 'uploadTranslations'
  | 'checkJobStatus'
  | 'translateMany'
>;

export type TranslateTarget =
  | { collection: string; id: string | number }
  | { global: string };

// Why a translated string was not written.
export type SkippedReason =
  // The row or block holding it no longer exists.
  | 'removed'
  // A link or format did not come back, or an unexpected tag did.
  | 'broken_markup'
  // The translation has no value for it.
  | 'missing';

export type SkippedString = { key: string; reason: SkippedReason };

export type LocaleResult =
  | {
      status: 'applied';
      applied: string[];
      skipped: SkippedString[];
    }
  | { status: 'failed'; error: string };

export type TranslateResult = {
  // Absent when the document could not be read or uploaded.
  error?: string;
  // GT refused the work because the plan's usage limit is reached.
  usageLimitReached?: true;
  locales: Record<string, LocaleResult>;
};
