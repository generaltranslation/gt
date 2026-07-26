import type { SourceAdapter } from '../adapters/types.js';

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
  /** Set by synthesis sites that KNOW the file did not exist before the run
   *  (gt.config.json when none was read, a created next.config, the
   *  dictionary loader, the locale resolvers). The report lists these under
   *  "Created" instead of "Converted". Transform rewrites never set it;
   *  absence means "not known to be new", never "known to be old". */
  created?: boolean;
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
  /** the directory the MIGRATION serves catalogs from (where loadDictionary is
   *  pointed, and where a format-converting adapter writes them). */
  dir: string;
  /**
   * The directory discovery actually READ the catalogs from, when it differs
   * from `dir`: react-i18next reads `locales/<locale>/*.json` and writes a new
   * `gt/dictionaries/`, and react-intl repoints `dir` at a sibling gt-owned
   * directory when it re-nests or synthesizes. The pre-flight line prints both,
   * so a user can see which files were found as well as where the migration will
   * serve them from (round-9 R1 #4: printing only one of the two named a
   * directory that did not exist, and printing only `dir` then hid the
   * discovery location). Absent when the two are the same.
   */
  sourceDir?: string;
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
  /** files whose programmatic navigation uses next-intl's locale-aware call
   *  signatures (router.replace(href, { locale }), redirect({ href, locale })).
   *  Each such file skips, and while any exist the createNavigation wrapper is
   *  held on next-intl (see transformNavigation) so those call sites keep
   *  resolving against the library that understands them. */
  localeAwareNavCallers?: string[];
  /** set when next.config's export shape forced the fallback wrap
   *  (withGTConfig around the WHOLE exported value) and the source library's
   *  plugin therefore stays composed inside it. The emit phase must then keep
   *  the library installed and its request/routing files on disk even on an
   *  otherwise-full migration, or the retained composition stops resolving. */
  nextConfigRetainsPlugin?: boolean;
  /** Server modules that CALL a function imported from a 'use client' module
   *  (e.g. a server page calling a local useLocalizedLabel() hook exported by
   *  a client-directive file). That is a latent React Server Components
   *  violation the app already carries: it only detonates when the route
   *  actually renders on the server, which request-scoped (dynamic ƒ) baseline
   *  rendering may never do at build time. Restoring static rendering would
   *  make prerender execute the call and fail the build, so the emit phase
   *  holds exactly the routes that reach one dynamic (or, when it cannot,
   *  withholds the static locale resolvers project-wide) and the report names
   *  each hazard. "Server module" is decided by the import graph, not by one
   *  file's directive: a file only ever imported from client modules is a
   *  client component, and a file nothing imports is in no route's graph. */
  latentClientCallHazards?: {
    caller: string;
    importedName: string;
    clientModule: string;
    /** App route entries (page/layout/route/...) whose server render reaches
     *  this caller, each with the import chain that gets there (entry first,
     *  caller last). Drives per-route containment in emitGtFiles. Empty means
     *  the detector could not place the caller in any route's graph with
     *  confidence (an import specifier it could not resolve), which forces the
     *  project-wide withhold; absent when a caller built the context by hand. */
    reachedFrom?: { entry: string; chain: string[] }[];
    /** Set when `reachedFrom` is a LOWER BOUND rather than the whole set: an
     *  import specifier the resolver could not follow could name this file (or
     *  a file that imports it), so another route may reach the same hazard
     *  through an edge the graph never saw. Holds that file, for the report.
     *  Per-route containment cannot be trusted then (it would leave that route
     *  prerendered with the hazard in its graph), so the emit phase falls back
     *  to withholding the resolvers project-wide and says why. */
    reachSetIncomplete?: string;
  }[];
  /** Test files (setup, render helpers, mocks, specs) that use the source
   *  library. No codemod can follow vi.mock()/jest.mock() of the source
   *  module or an IntlProvider render helper, and converting the components
   *  under test breaks the suites either way, so these are an explicit manual
   *  stage: excluded from conversion, listed in their own report section with
   *  the expectation set plainly, and counted as skips (provider and teardown
   *  survive for them) only when the file really imports the library; a
   *  mock-only mention is reported without being made a skip, since the mock
   *  is dead once the components under test are converted. Also includes test
   *  files reached transitively (a suite that renders through a flagged
   *  helper), which are report-only for the same reason. */
  testFilesNeedingMigration?: string[];
  /** Per-file wording for the report's test section, recorded at the
   *  classification site when deriving it from the file's own content would
   *  guess wrong (a suite flagged for importing converted code carries no
   *  source-library reference of its own). report.ts prefers this over its
   *  derived evidence. */
  testFileEvidence?: Map<string, string>;
  /** The `dictionary` value the emitted gt.config.json carries, and whether
   *  THIS run put it there. `gt generate`/`gt translate` read that key (see
   *  aggregateInlineTranslations), so the report's final step is only allowed
   *  to say bare `npx gt generate` works when the recorded dictionary really is
   *  the catalog this migration wired: a config that already named a different
   *  dictionary is never clobbered, and there the flag IS required. */
  recordedDictionary?: { path: string; wroteThisRun: boolean };
  /** Project files this run could not read (EACCES and friends), so no import
   *  of theirs is in the graph. The teardown decision is undecidable while one
   *  exists, and the report has to name the file and say so rather than filing
   *  the retained config under generic "retained wiring". */
  unreadableFiles?: string[];
};

export type SourceResult = {
  /** transformed code, or null when the file is unchanged */
  code: string | null;
  todos: TodoEntry[];
  /** non-empty means the whole file must be left untouched */
  skipReasons: string[];
  /**
   * Top-level warnings this transform raised, merged into `ctx.warnings` by
   * `collect` so they print at the end of the run instead of only in the TODO
   * list. Returned rather than pushed onto ctx directly because the config lane
   * classifies before it applies: a transform that pushed its own warning would
   * emit it twice.
   */
  warnings?: string[];
};
