export type MigrateOptions = {
  src?: string[];
  config: string;
  inline: boolean;
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
  usedRich: boolean;
};
