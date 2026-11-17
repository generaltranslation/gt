import type { MessageFormats, MessageTree } from '@generaltranslation/icu';

export type LegacyDataFormat = 'ICU' | 'JSX' | 'STRING' | 'MESSAGE_TREE';

export type ConvertedMessage = {
  tree: MessageTree;
  formats: MessageFormats;
};

export type ConversionResult =
  | ({ ok: true } & ConvertedMessage)
  | { ok: false; reason: string };

/** Maps a legacy variable name to the variable name the new source uses. */
export type RenameMap = Record<string, string>;

export type MatchTier =
  | 'same-key'
  | 'predicted-hash'
  | 'source-exact'
  | 'source-alpha'
  | 'source-loose';

export type BranchFillCounts = {
  /** Plural or selectordinal categories copied from the translation's `other`. */
  categories: number;
  /** Exact `=N` or select keys the source has and the translation lacked. */
  keys: number;
  /** Select keys only the translation had. */
  dropped: number;
};

export type LocaleOutcome =
  | { status: 'carried' }
  | { status: 'migrated'; filled?: BranchFillCounts }
  | { status: 'rejected'; reason: string }
  | { status: 'missing' };

export type MessageDecision = {
  newHash: string;
  dataFormat: LegacyDataFormat;
  source: unknown;
  staticId?: string;
  tier?: MatchTier;
  oldKey?: string;
  oldDataFormat?: LegacyDataFormat;
  renameMap?: RenameMap;
  notes: string[];
  locales: Record<string, LocaleOutcome>;
};

export type MigrationReport = {
  version: 1;
  defaultLocale: string;
  locales: string[];
  messages: MessageDecision[];
};
