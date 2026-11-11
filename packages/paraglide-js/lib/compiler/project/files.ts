import fs from 'node:fs';
import os from 'node:os';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { globby, isIgnoredByIgnoreFiles } from 'globby';
import picomatch from 'picomatch';
import { isWithin, relativeWithin, toPosix } from '../utils/paths.js';

/** Never app code, wherever they are. */
const IGNORED_DIRECTORIES = new Set([
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

/** The repository root at or above `directory`: where `.git` is. */
function gitRoot(directory: string): string | undefined {
  for (let current = directory; ; current = path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    if (path.dirname(current) === current) return undefined;
  }
}

/** `.gitignore` files, outside dependencies. */
const GITIGNORE_FILES = ['**/.gitignore'];

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
  const repository = gitRoot(projectRoot);
  const candidates = [workspaceRoot, repository].filter(
    (directory): directory is string =>
      directory !== undefined &&
      directory !== os.homedir() &&
      (directory === projectRoot || isWithin(directory, projectRoot))
  );
  // The nearest of the two.
  const base = candidates.sort((a, b) => b.length - a.length)[0] ?? projectRoot;
  if (base === projectRoot) return base;
  const ignored = await isIgnoredByIgnoreFiles(GITIGNORE_FILES, {
    cwd: base,
    ignore: IGNORED_GLOBS,
  });
  // The outermost directory between the base and the project that is ignored.
  const between: string[] = [];
  for (
    let current = projectRoot;
    current !== base;
    current = path.dirname(current)
  ) {
    between.unshift(current);
  }
  return (
    between.find(
      (directory) => ignored(`${directory}${path.sep}`) || ignored(directory)
    ) ?? base
  );
}

/** Build output at the project root. */
const IGNORED_AT_ROOT = [
  'dist',
  'build',
  'out',
  '.vitepress/cache',
  '.vitepress/dist',
];

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

type Pattern = {
  /** Where walking starts. */
  base: string;
  matches(file: string): boolean;
};

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

export type FileSelectionOptions = {
  projectRoot: string;
  workspaceRoot?: string;
  /** Default: the whole project root. */
  include?: readonly string[];
  /** Default: `DEFAULT_EXCLUDE`. */
  exclude?: readonly string[];
  /** Absolute directories to skip, e.g. Vite's `build.outDir` and `publicDir`. */
  ignoredDirectories?: readonly string[];
  isSourceFile(file: string): boolean;
};

/** Which files are analyzed: the files `include` lists, and files the bundler loads. */
export class FileSelection {
  private readonly exclude: Pattern[];
  private readonly ignoredDirectories: string[];
  /** Whether a file is `.gitignore`d (nested ones too), for files the bundler loads. */
  private isGitIgnored: ((file: string) => boolean) | undefined;

  constructor(private readonly options: FileSelectionOptions) {
    const { projectRoot } = options;
    this.exclude = (options.exclude ?? DEFAULT_EXCLUDE).map((entry) =>
      compilePattern(entry, projectRoot)
    );
    this.ignoredDirectories = [
      ...IGNORED_AT_ROOT.map((directory) => path.join(projectRoot, directory)),
      ...(options.ignoredDirectories ?? []),
    ];
  }

  /** Lists the included source files, and `auto-imports.d.ts` files among them. */
  async list(): Promise<{
    files: string[];
    missing: string[];
    autoImportDeclarations: string[];
  }> {
    const { projectRoot } = this.options;
    const missing: string[] = [];
    const patterns: string[] = [];
    for (const entry of this.options.include ?? ['.']) {
      if (picomatch.scan(entry).isGlob) {
        patterns.push(entry);
        continue;
      }
      const absolute = path.resolve(projectRoot, entry);
      const stat = await fsp.stat(absolute).catch(() => undefined);
      const relative = toPosix(path.relative(projectRoot, absolute)) || '.';
      if (!stat) missing.push(absolute);
      else patterns.push(stat.isDirectory() ? `${relative}/**` : relative);
    }
    // Every .gitignore from the base (the repository's root, a monorepo's root
    // one included) down to each file, as git applies them.
    const base = await ignoreBase(projectRoot, this.options.workspaceRoot);
    const prefix = toPosix(path.relative(base, projectRoot));
    const inBase = (pattern: string) =>
      prefix ? path.posix.join(prefix, pattern) : pattern;
    this.isGitIgnored = await isIgnoredByIgnoreFiles(GITIGNORE_FILES, {
      cwd: base,
      ignore: IGNORED_GLOBS,
    });
    const found =
      patterns.length === 0
        ? []
        : await globby(patterns.map(inBase), {
            cwd: base,
            absolute: true,
            dot: true,
            ignoreFiles: GITIGNORE_FILES,
            followSymbolicLinks: false,
            ignore: this.ignoreGlobs().map((glob) =>
              glob.startsWith('**/') ? glob : inBase(glob)
            ),
          });
    const all = found.map((file) => path.normalize(file));
    return {
      files: all.filter((file) => this.isSelected(file)).sort(),
      missing,
      autoImportDeclarations: all.filter(
        (file) => path.basename(file) === 'auto-imports.d.ts'
      ),
    };
  }

  /** Whether a file the bundler loaded is analyzed, wherever it is. */
  acceptsLoaded(file: string): boolean {
    if (!this.isSelected(file)) return false;
    const { projectRoot, workspaceRoot } = this.options;
    const base = isWithin(projectRoot, file)
      ? projectRoot
      : workspaceRoot && isWithin(workspaceRoot, file)
        ? workspaceRoot
        : undefined;
    if (!base) return true;
    const relative = relativeWithin(base, file)!;
    if (relative.split('/').some((segment) => IGNORED_DIRECTORIES.has(segment)))
      return false;
    if (this.ignoredDirectories.some((directory) => isWithin(directory, file)))
      return false;
    return base !== projectRoot || !this.isGitIgnored?.(file);
  }

  private isSelected(file: string): boolean {
    return (
      this.options.isSourceFile(file) &&
      !this.exclude.some((pattern) => pattern.matches(file))
    );
  }

  /** Dependencies, framework output and build output, relative to the project root. */
  private ignoreGlobs(): string[] {
    const { projectRoot } = this.options;
    return [
      ...IGNORED_GLOBS,
      ...this.ignoredDirectories
        .filter((directory) => isWithin(projectRoot, directory))
        .map((directory) => `${relativeWithin(projectRoot, directory)}/**`),
    ];
  }
}

/** Directories below `roots` that contain `fileName`, `.gitignore`d or not, outside dependencies. */
export async function findDirectoriesContaining(
  roots: readonly string[],
  fileName: string
): Promise<string[]> {
  const ignore = IGNORED_GLOBS;
  const found = await Promise.all(
    roots.map((cwd) =>
      globby(`**/${fileName}`, {
        cwd,
        absolute: true,
        dot: true,
        followSymbolicLinks: false,
        ignore,
      })
    )
  );
  return [
    ...new Set(found.flat().map((file) => path.dirname(path.normalize(file)))),
  ];
}
