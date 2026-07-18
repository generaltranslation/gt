import type { SourceAdapter } from './adapters/types.js';

export type MigrateOptions = {
  src?: string[];
  config: string;
  inline: boolean;
  dryRun: boolean;
  yes: boolean;
  allowDirty: boolean;
  /** source i18n library to migrate from; defaults to auto-detection. */
  from?: string;
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
   * Report TODOs raised during discovery (e.g. a synthesized source entry, or
   * conflicting `defaultMessage`s for one id). The driver merges these into
   * `ctx.todos`.
   */
  reportTodos?: TodoEntry[];
};

export type RoutingInfo = {
  locales: string[] | null;
  defaultLocale: string | null;
  localePrefix: 'always' | 'as-needed' | 'never' | null;
  pathnames: Record<string, unknown> | null;
  routingFile: string | null;
  requestFile: string | null;
};

export type MigrationContext = {
  cwd: string;
  catalogs: MessageCatalogs;
  routing: RoutingInfo;
  edits: FileEdit[];
  todos: TodoEntry[];
  /** top-level advisory notes surfaced in the report's Warnings section. */
  warnings?: string[];
  /** file path -> reasons the file was left untouched */
  skippedFiles: Map<string, string[]>;
  stats: Record<string, number>;
  /** all matched source files, for still-imported checks before deletions */
  sourceFiles?: string[];
  /** every source file in the project regardless of --src scope, so teardown
   *  decisions never rely on what happened to be scanned */
  projectFiles?: string[];
  /** true when --inline was passed; gates transforms that embed
   *  source-language text (and so require re-translation) */
  inlineMode?: boolean;
  /** the source-library adapter driving this migration. Required: the driver
   *  resolves it from the detected source library (or --from), and every
   *  transform reads the library-specific tables and strings from it. Unit
   *  tests that build a context by hand pass nextIntlAdapter explicitly. */
  adapter: SourceAdapter;
};

export type SourceResult = {
  /** transformed code, or null when the file is unchanged */
  code: string | null;
  todos: TodoEntry[];
  /** non-empty means the whole file must be left untouched */
  skipReasons: string[];
  usedRich: boolean;
};
