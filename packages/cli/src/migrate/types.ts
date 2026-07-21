import type { SourceAdapter } from './adapters/types.js';

export type MigrateOptions = {
  src?: string[];
  config: string;
  /** i18n library to migrate from (--from, required; validated against the
   *  adapter registry: next-intl, react-intl, react-i18next) */
  from: string;
  dryRun: boolean;
  yes: boolean;
  allowDirty: boolean;
};

export type FileEdit = {
  path: string;
  kind: 'write' | 'delete';
  content?: string;
};

export type TodoEntry = {
  file: string;
  line?: number;
  reason: string;
};

export type MessageCatalogs = {
  defaultLocale: string;
  locales: string[];
  byLocale: Record<string, Record<string, unknown>>;
  dir: string;
  /**
   * Catalog files the adapter synthesized during discovery and needs written to
   * disk (never a mutation of an existing file, new files only). react-intl
   * uses this to seed a missing default-locale catalog from harvested literal
   * `defaultMessage`s (the id-problem case b2), and to re-nest dotted flat keys
   * (`{"a.b": …}` -> `{a:{b:…}}`) into new files so gt-next's nested-path
   * resolver can find them; emitGtFiles flushes them through the normal edit
   * pipeline so they respect --dry-run.
   */
  filesToEmit?: FileEdit[];
  /**
   * Ids present in the source catalog both as a leaf and as a namespace prefix
   * (e.g. both `"a"` and `"a.b"`), which cannot be represented in gt-next's
   * nested dictionary. The transform skips+reports any file referencing one.
   */
  flatKeyCollisions?: string[];
  /**
   * Top-level advisory notes raised during catalog discovery (e.g. an assumed
   * default locale). The driver merges these into `ctx.warnings` so the report
   * surfaces them once.
   */
  warnings?: string[];
  /**
   * Report TODOs raised during discovery, already anchored to a source FILE
   * (e.g. a synthesized source entry, or conflicting `defaultMessage`s for one
   * id). The driver merges these into `ctx.todos` right after context
   * construction. Distinct from `reports` below: those are anchored to a catalog
   * KEY and materialized into TODOs later, during the emit phase.
   */
  reportTodos?: TodoEntry[];
  /**
   * Per-catalog-KEY conversion notes from an adapter that rewrites catalog
   * FORMATS (react-i18next: i18next JSON -> ICU); the format converter stays
   * ignorant of the output directory, so each note is keyed by
   * `locale/ns:keypath` and turned into a file-anchored `ctx.todos` entry later,
   * in the adapter's `emitCatalogs` (which knows the output dir). Absent for
   * pass-through adapters. Distinct from `reportTodos` above (file-anchored,
   * merged at construction time).
   */
  reports?: { key: string; reason: string }[];
};

export type RoutingInfo = {
  locales: string[] | null;
  defaultLocale: string | null;
  localePrefix: 'always' | 'as-needed' | 'never' | null;
  /** localePrefix is present in the routing config but not statically
   *  resolvable (a variable reference, a computed value). Consumers must not
   *  read the null above as next-intl's default in that case. */
  localePrefixUnresolved?: boolean;
  pathnames: Record<string, unknown> | null;
  /** pathnames is present but not statically resolvable; treat as "localized
   *  pathnames exist", never as absent. */
  pathnamesUnresolved?: boolean;
  routingFile: string | null;
  requestFile: string | null;
};

export type MigrationContext = {
  cwd: string;
  catalogs: MessageCatalogs;
  routing: RoutingInfo;
  edits: FileEdit[];
  todos: TodoEntry[];
  /**
   * Top-level warnings surfaced at the top of the report (and echoed to the
   * console at the end of the run), not buried in the TODO list. Severity spans
   * mild advisory notes (an assumed default locale) to loud correctness risks
   * (a `[lng]` segment that makes every non-default locale render in the default
   * language); the adapter chooses the wording.
   */
  warnings?: string[];
  /** file path -> reasons the file was left untouched */
  skippedFiles: Map<string, string[]>;
  stats: Record<string, number>;
  /** all matched source files, for still-imported checks before deletions */
  sourceFiles?: string[];
  /** every source file in the project regardless of --src scope, so teardown
   *  decisions never rely on what happened to be scanned */
  projectFiles?: string[];
  /** the source-library adapter driving this migration. Required: the driver
   *  resolves it from the --from value, and every transform reads the
   *  library-specific tables and strings from it. Unit tests that build a
   *  context by hand pass nextIntlAdapter explicitly. */
  adapter: SourceAdapter;
  /** resolved --config path; gt.config.json is read from and written to this
   *  path (defaults to <cwd>/gt.config.json when the flag is absent) */
  configFile?: string;
};

export type SourceResult = {
  /** transformed code, or null when the file is unchanged */
  code: string | null;
  todos: TodoEntry[];
  /** non-empty means the whole file must be left untouched */
  skipReasons: string[];
};
