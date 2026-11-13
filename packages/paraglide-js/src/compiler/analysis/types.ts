export type UsageKind = 'call' | 'method' | 'reference';

export type SourceRange = { start: number; end: number };

export type ParaglideUsage = {
  /** The target's name, e.g. "message". */
  target: string;
  /** The name within the target, e.g. a message id. */
  name: string;
  /**
   * The name is computed: `name` is a pattern where `*` stands for any text.
   * `m[key]` → "*"; `` m[`error_${code}`] `` → "error_*".
   */
  dynamic?: boolean;
  /** For messages: the inlang project that defines them, project-relative. Unset if unknown. */
  inlangProject?: string;
  kind: UsageKind;
  /** UTF-16 offsets. */
  start: number;
  end: number;
  line: number;
  column: number;
  endLine: number;
  /** The target's file, absolute. */
  targetFile: string;
};

export type FileUsages = {
  /** Project-relative. */
  file: string;
  code: string;
  usages: ParaglideUsage[];
};

export type TrackedValue = {
  type: 'value';
  /** `name` is a pattern, see `ParaglideUsage.dynamic`. */
  dynamic?: boolean;
  target: string;
  name: string;
  methods: readonly string[];
  /** The target's file, absolute. */
  file: string;
};

export type TrackedNamespace = {
  type: 'namespace';
  member(name: string): TrackedSymbol | undefined;
};

export type TrackedSymbol = TrackedValue | TrackedNamespace;
