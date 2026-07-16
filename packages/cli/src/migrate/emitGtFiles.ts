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
  const loaderExists = ['loadDictionary.ts', 'loadDictionary.js', 'src/loadDictionary.ts', 'src/loadDictionary.js'].some(
    (candidate) => fs.existsSync(path.join(ctx.cwd, candidate))
  );
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
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      let changed = false;
      for (const section of ['dependencies', 'devDependencies']) {
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
    for (const configFile of [ctx.routing.routingFile, ctx.routing.requestFile]) {
      if (configFile && fs.existsSync(configFile)) {
        edits.push({ path: configFile, kind: 'delete' });
      }
    }
  }

  return edits;
}

function toPosix(value: string): string {
  return value.split(path.sep).join('/');
}
