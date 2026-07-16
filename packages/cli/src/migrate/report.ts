import path from 'node:path';
import type { MigrationContext } from './types.js';

/**
 * Renders the migration report: what was converted, what was skipped and
 * why, every TODO, and the follow-up steps. Nothing the command declined to
 * convert is allowed to be absent from this report.
 */
export function buildReport(ctx: MigrationContext, dryRun: boolean): string {
  const lines: string[] = [];
  const relative = (file: string) =>
    path.isAbsolute(file) ? path.relative(ctx.cwd, file) : file;

  lines.push(`# gt migrate report${dryRun ? ' (dry run — nothing written)' : ''}`);
  lines.push('');
  lines.push(
    `Migrated next-intl -> gt-next (dictionary compat mode). Default locale: ` +
      `${ctx.catalogs.defaultLocale}; locales: ${ctx.catalogs.locales.join(', ')}.`
  );
  lines.push('');

  lines.push('## Converted');
  lines.push('');
  const written = ctx.edits.filter((edit) => edit.kind === 'write');
  const deleted = ctx.edits.filter((edit) => edit.kind === 'delete');
  if (written.length === 0) {
    lines.push('- (no files changed)');
  }
  for (const edit of written) {
    lines.push(`- ${relative(edit.path)}`);
  }
  for (const edit of deleted) {
    lines.push(`- ${relative(edit.path)} (deleted)`);
  }
  lines.push('');
  lines.push(
    `Existing translations preserved: catalogs in ${relative(ctx.catalogs.dir)}/ ` +
      'now load through loadDictionary.ts — no re-translation needed.'
  );
  lines.push('');

  if (ctx.skippedFiles.size > 0) {
    lines.push('## Needs manual migration (files left untouched)');
    lines.push('');
    lines.push(
      'next-intl is still installed and NextIntlClientProvider still renders ' +
        '(nested inside GTProvider) so these keep working. Re-run `gt migrate` ' +
        'after converting them to finish the teardown.'
    );
    lines.push('');
    for (const [file, reasons] of ctx.skippedFiles) {
      lines.push(`- ${relative(file)}`);
      for (const reason of reasons) {
        lines.push(`  - ${reason}`);
      }
    }
    lines.push('');
  }

  if (ctx.todos.length > 0) {
    lines.push('## TODOs');
    lines.push('');
    for (const todo of ctx.todos) {
      const location = todo.line
        ? `${relative(todo.file)}:${todo.line}`
        : relative(todo.file);
      lines.push(`- ${location} — ${todo.reason}`);
    }
    lines.push('');
  }

  lines.push('## Behavior differences to know about');
  lines.push('');
  lines.push(
    '- Unknown dictionary keys throw in gt-next (next-intl rendered the raw key and logged).'
  );
  lines.push(
    '- Programmatic navigation (redirect, router.push) is not locale-prefixed automatically; <Link> from gt-next/link is.'
  );
  lines.push('');

  lines.push('## Next steps');
  lines.push('');
  lines.push('1. Review the TODOs above, then run your build.');
  lines.push(
    '2. `npx gt generate` (no API key) or `npx gt translate` (with credentials) to translate new locales.'
  );
  lines.push(
    '3. Optionally re-run with `--inline` to convert simple strings to inline <T> components.'
  );
  lines.push('');

  return lines.join('\n');
}
