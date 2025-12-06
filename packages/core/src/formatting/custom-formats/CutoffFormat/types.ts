// ========== Base Types ========== //

/** Type of terminator */
export type CutoffFormatStyle = 'none' | 'ellipsis';

/** Terminator options */
export interface TerminatorOptions {
  /** The terminator to use */
  terminator?: string;
  /** An optional separator between the terminator and the value */
  separator?: string;
}

/** Input formatting options (for constructor) */
export interface CutoffFormatOptions extends TerminatorOptions {
  /** Cutoff length */
  maxChars?: number;
  /** Type of terminator */
  style?: CutoffFormatStyle;
}

// ========== Resolved Options ========== //

/** Resolved terminator options */
export interface ResolvedTerminatorOptions extends TerminatorOptions {
  terminator: string | undefined;
  separator: string | undefined;
}

/** Resolved options (after constructor) */
export interface ResolvedCutoffFormatOptions
  extends CutoffFormatOptions,
    ResolvedTerminatorOptions {
  maxChars: number | undefined;
  style: CutoffFormatStyle | undefined;
  terminator: string | undefined;
  separator: string | undefined;
}

// ========== Formatting Parts ========== //

/** Prepended cutoff list */
export type PrependedCutoffParts =
  | [string]
  | [ResolvedTerminatorOptions['terminator'], string]
  | [
      ResolvedTerminatorOptions['terminator'],
      ResolvedTerminatorOptions['separator'],
      string,
    ];

/** Postpended cutoff list */
export type PostpendedCutoffParts =
  | [string]
  | [string, ResolvedTerminatorOptions['terminator']]
  | [
      string,
      ResolvedTerminatorOptions['separator'],
      ResolvedTerminatorOptions['terminator'],
    ];

// ========== Cutoff Format Class ========== //

/**
 * Cutoff Class interface
 */
export interface CutoffFormat {
  format: (value: string) => string;
  resolvedOptions: () => ResolvedCutoffFormatOptions;
  formatToParts: (
    value: string
  ) => PrependedCutoffParts | PostpendedCutoffParts;
}
