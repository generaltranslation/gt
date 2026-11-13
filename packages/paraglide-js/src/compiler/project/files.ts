import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { globby, globbyStream, isIgnoredByIgnoreFiles } from 'globby';
import picomatch from 'picomatch';
import { isWithin, relativePath, toPosix } from '../utils/paths.js';

export type FileSelectionOptions = {
  projectRoot: string;
  workspaceRoot?: string;
  /** Default: the whole project root. */
  include?: readonly string[];
  /** Default: `DEFAULT_EXCLUDE`. */
  exclude?: readonly string[];
  isSourceFile(file: string): boolean;
};

export type ListOptions = {
  /**
   * Told of the selected files as they are found, in batches, before `list`
   * resolves: what is done with them overlaps the listing of the others.
   */
  onFiles?(files: string[]): void;
};

/** How many files `onFiles` is told of at a time. */
const LISTED_BATCH = 256;

export type SelectedFiles = {
  /** The included source files, absolute and sorted. */
  files: string[];
  /** The `include` entries that do not exist, absolute. */
  missing: string[];
  /** The `auto-imports.d.ts` files among the included ones. */
  autoImportDeclarations: string[];
};

type Pattern = {
  /** Where walking starts. */
  base: string;
  matches(file: string): boolean;
};

type IncludePatterns = {
  /** Globs relative to the project root. */
  patterns: string[];
  missing: string[];
};

/** Never app code, wherever they are. */
export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.astro',
  '.vercel',
  '.netlify',
  '.wrangler',
  '.vinxi',
  '.tanstack',
  '.turbo',
  '.cache',
  '.next',
  '.angular',
  '.nx',
  '.yarn',
  '.pnpm-store',
  '.react-router',
  '.vite',
  '.idea',
  'coverage',
  'storybook-static',
]);

const IGNORED_GLOBS = [...IGNORED_DIRECTORIES].map((name) => `**/${name}/**`);

/** Build output at the project root. */
const IGNORED_AT_ROOT = [
  'dist',
  'build',
  'out',
  '.vitepress/cache',
  '.vitepress/dist',
];

/** Dependencies, framework output and build output, relative to the project root. */
const PROJECT_IGNORE_GLOBS = [
  ...IGNORED_GLOBS,
  ...IGNORED_AT_ROOT.map((directory) => `${directory}/**`),
];

/** `.gitignore` files, outside dependencies. */
const GITIGNORE_FILES = ['**/.gitignore'];

/** Tests and tool configs are not app usages. Replaced by the `exclude` option. */
export const DEFAULT_EXCLUDE: readonly string[] = [
  // vite.config.ts, svelte.config.js, nuxt.config.ts, eslint.config.mjs, …
  '*.config.?(c|m)[jt]s',
  '**/*.{test,spec}.?(c|m)[jt]s?(x)',
  '**/__tests__/**',
  '**/__mocks__/**',
  'test/**',
  'tests/**',
  'e2e/**',
  'cypress/**',
  'playwright/**',
];

export function isInIgnoredDirectory(file: string): boolean {
  return toPosix(file)
    .split('/')
    .some((segment) => IGNORED_DIRECTORIES.has(segment));
}

/** Which files are analyzed: the source files `include` lists. */
export class FileSelection {
  private readonly exclude: Pattern[];

  constructor(private readonly options: FileSelectionOptions) {
    this.exclude = (options.exclude ?? DEFAULT_EXCLUDE).map((entry) =>
      compilePattern(entry, options.projectRoot)
    );
  }

  /** Lists the included source files, and `auto-imports.d.ts` files among them. */
  async list({ onFiles }: ListOptions = {}): Promise<SelectedFiles> {
    const { projectRoot, workspaceRoot } = this.options;
    const { patterns, missing } = await this.includePatterns();

    const base = await ignoreBase(projectRoot, workspaceRoot);
    const onFound =
      onFiles &&
      ((found: string[]) => {
        const selected = found.filter((file) => this.isSelected(file));
        if (selected.length > 0) onFiles(selected);
      });
    const all = await findFiles(patterns, projectRoot, base, onFound);

    return {
      files: all.filter((file) => this.isSelected(file)).sort(),
      missing,
      autoImportDeclarations: all.filter(
        (file) => path.basename(file) === 'auto-imports.d.ts'
      ),
    };
  }

  /** `include` as globs: a directory is everything in it, a glob stays as it is. */
  private async includePatterns(): Promise<IncludePatterns> {
    const { projectRoot, include = ['.'] } = this.options;
    const patterns: string[] = [];
    const missing: string[] = [];

    for (const entry of include) {
      if (picomatch.scan(entry).isGlob) {
        patterns.push(entry);
        continue;
      }

      const absolute = path.resolve(projectRoot, entry);
      const stat = await fsp.stat(absolute).catch(() => undefined);
      const relative = relativePath(projectRoot, absolute);

      if (!stat) missing.push(absolute);
      else patterns.push(stat.isDirectory() ? `${relative}/**` : relative);
    }

    return { patterns, missing };
  }

  private isSelected(file: string): boolean {
    return (
      this.options.isSourceFile(file) &&
      !this.exclude.some((pattern) => pattern.matches(file))
    );
  }
}

/** A path or glob relative to `root`: `"src"`, `"app.vue"`, `"**\/*.stories.tsx"`. */
function compilePattern(entry: string, root: string): Pattern {
  const scan = picomatch.scan(entry);

  if (scan.isGlob) {
    const absolute = toPosix(path.resolve(root, entry));
    const isMatch = picomatch(absolute, { dot: true });

    return {
      base: path.resolve(root, scan.base),
      matches: (file) => isMatch(toPosix(file)),
    };
  }

  const base = path.resolve(root, entry);

  return { base, matches: (file) => file === base || isWithin(base, file) };
}

/**
 * The files matching `patterns`, which are relative to the project root, with
 * their paths normalized. Every .gitignore from `base` (the repository's root,
 * a monorepo's root one included) down to each file applies, as git applies
 * them. With `onFound`, the files are streamed to it in batches as they are found.
 */
async function findFiles(
  patterns: readonly string[],
  projectRoot: string,
  base: string,
  onFound?: (files: string[]) => void
): Promise<string[]> {
  if (patterns.length === 0) return [];

  const prefix = toPosix(path.relative(base, projectRoot));
  const inBase = (pattern: string) =>
    prefix ? path.posix.join(prefix, pattern) : pattern;
  const globs = patterns.map(inBase);
  const options = {
    cwd: base,
    absolute: true,
    dot: true,
    ignoreFiles: GITIGNORE_FILES,
    followSymbolicLinks: false,
    ignore: PROJECT_IGNORE_GLOBS.map((glob) =>
      glob.startsWith('**/') ? glob : inBase(glob)
    ),
  };

  if (!onFound) {
    const found = await globby(globs, options);
    return found.map((file) => path.normalize(file));
  }

  const found: string[] = [];
  let batch: string[] = [];

  for await (const entry of globbyStream(globs, options)) {
    const file = path.normalize(String(entry));
    found.push(file);
    batch.push(file);

    if (batch.length === LISTED_BATCH) {
      onFound(batch);
      batch = [];
    }
  }
  if (batch.length > 0) onFound(batch);

  return found;
}

/**
 * Where `.gitignore` files apply from: the monorepo or repository root (not a
 * home directory under version control). If a parent repository ignores the
 * project itself, e.g. a generated example, it is still built: then from the
 * ignored directory down, so the ignore files inside it still apply.
 */
async function ignoreBase(
  projectRoot: string,
  workspaceRoot: string | undefined
): Promise<string> {
  const base = nearestRoot(projectRoot, [workspaceRoot, gitRoot(projectRoot)]);
  if (base === projectRoot) return base;

  const isIgnored = await isIgnoredByIgnoreFiles(GITIGNORE_FILES, {
    cwd: base,
    ignore: IGNORED_GLOBS,
  });

  // The outermost directory between the base and the project that is ignored.
  const ignoredDirectory = directoriesBelow(base, projectRoot).find(
    (directory) => isIgnored(`${directory}${path.sep}`) || isIgnored(directory)
  );

  return ignoredDirectory ?? base;
}

/** The nearest of `roots` at or above the project, else the project root itself. */
function nearestRoot(
  projectRoot: string,
  roots: ReadonlyArray<string | undefined>
): string {
  const candidates = roots.filter(
    (directory): directory is string =>
      directory !== undefined &&
      directory !== os.homedir() &&
      (directory === projectRoot || isWithin(directory, projectRoot))
  );
  const [nearest] = candidates.sort((a, b) => b.length - a.length);

  return nearest ?? projectRoot;
}

/** The directories from below `top` down to `directory`, outermost first. */
function directoriesBelow(top: string, directory: string): string[] {
  const directories: string[] = [];

  for (let current = directory; current !== top; ) {
    directories.unshift(current);
    current = path.dirname(current);
  }

  return directories;
}

/** The repository root at or above `directory`: where `.git` is. */
function gitRoot(directory: string): string | undefined {
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current;

    const isFilesystemRoot = path.dirname(current) === current;
    if (isFilesystemRoot) return undefined;
  }
}
