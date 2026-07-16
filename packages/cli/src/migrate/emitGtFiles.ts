import fs from 'node:fs';
import path from 'node:path';
import type { FileEdit, MigrationContext } from './types.js';

/**
 * Emits the gt-next scaffolding: gt.config.json (merged with any existing
 * one), a loadDictionary loader for the preserved per-locale catalogs, the
 * package.json edit, and deletions of the now-unused next-intl config files.
 * next-intl teardown only happens once no skipped files remain.
 */
export function emitGtFiles(ctx: MigrationContext): FileEdit[] {
  const edits: FileEdit[] = [];
  const fullyMigrated = ctx.skippedFiles.size === 0;

  // gt.config.json
  const configPath = path.join(ctx.cwd, 'gt.config.json');
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // Unreadable existing config: preserve nothing, report via todo.
      ctx.todos.push({
        file: configPath,
        reason: 'existing gt.config.json could not be parsed and was replaced',
      });
    }
  }
  const existingFiles =
    existing.files && typeof existing.files === 'object'
      ? (existing.files as Record<string, unknown>)
      : {};
  const config = {
    ...existing,
    defaultLocale: ctx.catalogs.defaultLocale,
    locales: ctx.catalogs.locales,
    files: {
      ...existingFiles,
      gt: { output: 'public/_gt/[locale].json' },
    },
  };
  edits.push({
    path: configPath,
    kind: 'write',
    content: JSON.stringify(config, null, 2) + '\n',
  });

  // loadDictionary.ts — serves the preserved next-intl catalogs per locale.
  const loaderExists = [
    'loadDictionary.ts',
    'loadDictionary.js',
    'src/loadDictionary.ts',
    'src/loadDictionary.js',
  ].some((candidate) => fs.existsSync(path.join(ctx.cwd, candidate)));
  if (loaderExists) {
    ctx.todos.push({
      file: path.join(ctx.cwd, 'loadDictionary.ts'),
      reason:
        'a loadDictionary file already exists — verify it serves the migrated catalogs',
    });
  } else {
    // Place inside src/ when the app uses one (matches Next's compilation
    // scope — a root-level loader is detected by gt-next but its webpack
    // alias can fail to compile) and import relative to the file itself.
    const useSrc = fs.existsSync(path.join(ctx.cwd, 'src'));
    const loaderPath = path.join(
      ctx.cwd,
      useSrc ? 'src/loadDictionary.ts' : 'loadDictionary.ts'
    );
    const relativeDir = toPosix(
      path.relative(path.dirname(loaderPath), ctx.catalogs.dir)
    );
    const importDir = relativeDir.startsWith('.')
      ? relativeDir
      : `./${relativeDir}`;
    edits.push({
      path: loaderPath,
      kind: 'write',
      content: [
        'const loadDictionary = async (locale: string) => {',
        '  try {',
        `    return (await import(\`${importDir}/\${locale}.json\`)).default;`,
        '  } catch {',
        '    return {};',
        '  }',
        '};',
        '',
        'export default loadDictionary;',
        'export { loadDictionary };',
        '',
      ].join('\n'),
    });
  }

  // package.json + next-intl config teardown, only when fully migrated.
  if (fullyMigrated) {
    const packageJsonPath = path.join(ctx.cwd, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      let pkg: Record<string, Record<string, string>> | null = null;
      try {
        pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      } catch (error) {
        ctx.todos.push({
          file: packageJsonPath,
          reason: `could not be parsed (${String(error)}) — remove the next-intl dependency by hand`,
        });
      }
      if (pkg) {
        let changed = false;
        for (const section of [
          'dependencies',
          'devDependencies',
          'peerDependencies',
          'optionalDependencies',
        ]) {
          if (pkg[section] && pkg[section]['next-intl']) {
            delete pkg[section]['next-intl'];
            changed = true;
          }
        }
        if (changed) {
          edits.push({
            path: packageJsonPath,
            kind: 'write',
            content: JSON.stringify(pkg, null, 2) + '\n',
          });
        }
      }
    }
    const deletions = [ctx.routing.routingFile, ctx.routing.requestFile].filter(
      (file): file is string => file !== null && fs.existsSync(file)
    );
    for (const configFile of deletions) {
      // Deleting a module that something still imports breaks the build —
      // keep it and say so instead.
      const importer = findRemainingImporter(ctx, configFile, deletions);
      if (importer) {
        ctx.todos.push({
          file: configFile,
          reason: `kept because ${path.relative(ctx.cwd, importer)} still imports it — migrate that reference off next-intl, then delete this file`,
        });
        continue;
      }
      edits.push({ path: configFile, kind: 'delete' });
    }
  }

  return edits;
}

/**
 * Finds a source file whose post-migration content still imports `target`.
 * Contents come from the pending edit when one exists, otherwise from disk.
 * Import specifiers resolve relative to the importer; `@/` and `~/` map to
 * src/ (or the project root when there is no src/).
 */
function findRemainingImporter(
  ctx: MigrationContext,
  target: string,
  ignoredFiles: string[]
): string | null {
  const targetNoExt = stripExtension(target);
  const pendingEdits = new Map(
    ctx.edits
      .filter((edit) => edit.kind === 'write')
      .map((edit) => [edit.path, edit.content ?? ''])
  );
  const aliasRoot = fs.existsSync(path.join(ctx.cwd, 'src'))
    ? path.join(ctx.cwd, 'src')
    : ctx.cwd;
  const specifierPattern =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

  for (const file of ctx.sourceFiles ?? []) {
    if (ignoredFiles.includes(file)) continue;
    const content =
      pendingEdits.get(file) ??
      (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '');
    for (const match of content.matchAll(specifierPattern)) {
      const specifier = match[1];
      let resolved: string | null = null;
      if (specifier.startsWith('.')) {
        resolved = path.resolve(path.dirname(file), specifier);
      } else if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
        resolved = path.join(aliasRoot, specifier.slice(2));
      }
      if (
        resolved !== null &&
        (stripExtension(resolved) === targetNoExt ||
          path.join(resolved, 'index') === targetNoExt)
      ) {
        return file;
      }
    }
  }
  return null;
}

function stripExtension(file: string): string {
  return file.replace(/\.(?:[cm]?[jt]s|[jt]sx)$/, '');
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
