export type TargetFile = {
  /** Absolute, with forward slashes. */
  file: string;
  /** The Paraglide outdir containing the file, absolute, with forward slashes. */
  outdir: string | undefined;
  /** Relative to `outdir`, e.g. "messages.js". */
  outdirPath: string | undefined;
};

export type SymbolSpec =
  | { type: 'namespace'; member(name: string): SymbolSpec | undefined }
  | {
      type: 'value';
      name: string;
      /** Methods whose calls also count, e.g. `.parts()` on messages. */
      methods?: readonly string[];
    };

/** Defines which resolved files belong to Paraglide and what their exports are. */
export type ParaglideTarget = {
  name: string;
  matches(file: TargetFile): boolean;
  /** Return undefined to not track an export. */
  exportSymbol(exportName: string, file: TargetFile): SymbolSpec | undefined;
};

export function defineTarget(target: ParaglideTarget): ParaglideTarget {
  return target;
}

const createMessageExportSymbol = (id: string): SymbolSpec => ({
  type: 'value',
  name: id,
  methods: ['parts'],
});

/** `messages.js` (with the `m` namespace) and every module in `messages/`. */
export const messagesTarget: ParaglideTarget = {
  name: 'message',
  matches: ({ outdirPath = '' }) =>
    outdirPath === 'messages.js' ||
    (outdirPath.startsWith('messages/') && outdirPath.endsWith('.js')),
  exportSymbol: (exportName, file) =>
    file.outdirPath === 'messages.js' && exportName === 'm'
      ? { type: 'namespace', member: createMessageExportSymbol }
      : createMessageExportSymbol(exportName),
};

export const defaultTargets: readonly ParaglideTarget[] = [messagesTarget];

/**
 * Whether the analysis matches `target` without calling its functions: it is
 * `messagesTarget`, or a copy of it with both of its functions as they were.
 * Any other target is asked in JavaScript.
 */
export function isMessagesTarget(target: ParaglideTarget): boolean {
  return (
    target.matches === messagesTarget.matches &&
    target.exportSymbol === messagesTarget.exportSymbol
  );
}
