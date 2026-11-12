/** `component`: `<ParaglideMessage />` */
export type UsageKind = 'call' | 'method' | 'reference' | 'component';

export type ElementContext = {
  element: string;
  /** Absent when the usage is a child of `element`. */
  attribute?: string;
};

export type SourceRange = { start: number; end: number };

/** A template expression and its element. */
export type ElementRange = {
  start: number;
  end: number;
  context: ElementContext;
};

export type CatalogCheck = {
  /** Whether the catalog has `name`, or for a dynamic name, any message matching it. */
  exists: boolean;
  /** For a dynamic name, the message ids it matches. */
  matches?: string[];
};

export type ParaglideUsage = {
  /** The target's name, e.g. "message" or "runtime". */
  target: string;
  /** The name within the target, e.g. a message id. */
  name: string;
  /**
   * The name is computed: `name` is a pattern where `*` stands for any text.
   * `m[key]` → "*"; `` m[`error_${code}`] `` → "error_*".
   */
  dynamic?: boolean;
  /** For messages: whether the project's catalog has them. Unset if the catalog is unknown. */
  catalog?: CatalogCheck;
  /** For messages: the inlang project that defines them, project-relative. Unset if unknown. */
  inlangProject?: string;
  kind: UsageKind;
  /** For `kind: "method"`, e.g. "parts". */
  method?: string;
  expression: string;
  /** UTF-16 offsets. */
  start: number;
  end: number;
  line: number;
  column: number;
  endLine: number;
  /** Nearest named enclosing function, else the component file's name. */
  scope?: string;
  element?: ElementContext;
  /** Project-relative modules followed, ending at the Paraglide file. */
  resolution: string[];
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
  /** Absolute paths of the modules followed, ending at the target file. */
  via: string[];
};

export type TrackedNamespace = {
  type: 'namespace';
  member(name: string): TrackedSymbol | undefined;
};

export type TrackedSymbol = TrackedValue | TrackedNamespace;
