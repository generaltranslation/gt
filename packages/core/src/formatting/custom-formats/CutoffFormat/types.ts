/** Terminator style. */
export type CutoffFormatStyle = 'none' | 'ellipsis';

/** Terminator options. */
export interface TerminatorOptions {
  /** The terminator to use. */
  terminator?: string;
  /** Optional separator between the terminator and the value. */
  separator?: string;
}

/** Input formatting options for the constructor. */
export interface CutoffFormatOptions extends TerminatorOptions {
  /** Cutoff length. */
  maxChars?: number;
  /** Terminator style. */
  style?: CutoffFormatStyle;
}

/** Resolved terminator options. */
export interface ResolvedTerminatorOptions extends TerminatorOptions {
  terminator: string | undefined;
  separator: string | undefined;
}

/** Options resolved by the constructor. */
export interface ResolvedCutoffFormatOptions
  extends CutoffFormatOptions,
    ResolvedTerminatorOptions {
  maxChars: number | undefined;
  style: CutoffFormatStyle | undefined;
  terminator: string | undefined;
  separator: string | undefined;
}

/** Parts for a cutoff added before the value. */
export type PrependedCutoffParts =
  | [string]
  | [ResolvedTerminatorOptions['terminator'], string]
  | [
      ResolvedTerminatorOptions['terminator'],
      ResolvedTerminatorOptions['separator'],
      string,
    ];

/** Parts for a cutoff added after the value. */
export type PostpendedCutoffParts =
  | [string]
  | [string, ResolvedTerminatorOptions['terminator']]
  | [
      string,
      ResolvedTerminatorOptions['separator'],
      ResolvedTerminatorOptions['terminator'],
    ];

/**
 * Cutoff format interface.
 */
export interface CutoffFormat {
  format: (value: string) => string;
  resolvedOptions: () => ResolvedCutoffFormatOptions;
  formatToParts: (
    value: string
  ) => PrependedCutoffParts | PostpendedCutoffParts;
}
