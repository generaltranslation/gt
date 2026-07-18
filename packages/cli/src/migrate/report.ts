import path from 'node:path';
import { nextIntlAdapter } from './adapters/nextIntl.js';
import type { MigrationContext } from './types.js';

/**
 * Renders the migration report: what was converted, what was skipped and
 * why, every TODO, and the follow-up steps. Nothing the command declined to
 * convert is allowed to be absent from this report.
 */
export function buildReport(
  ctx: MigrationContext,
  dryRun: boolean,
  gtNextMissing: boolean = false
): string {
  const adapter = ctx.adapter ?? nextIntlAdapter;
  const lines: string[] = [];
  const relative = (file: string) =>
    path.isAbsolute(file) ? path.relative(ctx.cwd, file) : file;

  lines.push(
    `# gt migrate report${dryRun ? ' (dry run — nothing written)' : ''}`
  );
  lines.push('');
  lines.push(
    `Migrated ${adapter.displayName} -> gt-next (dictionary compat mode). Default locale: ` +
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

  // getLocale is the locale resolver (reads next/root-params); getRegion just
  // returns undefined. The report must only credit static rendering to what was
  // actually emitted: when getLocale already existed and was left untouched, the
  // claim hinges on that pre-existing file, not on the getRegion we emitted.
  const emittedGetLocale = ctx.edits.find(
    (edit) =>
      edit.kind === 'write' && path.basename(edit.path) === 'getLocale.ts'
  );
  const emittedGetRegion = ctx.edits.find(
    (edit) =>
      edit.kind === 'write' && path.basename(edit.path) === 'getRegion.ts'
  );
  if (emittedGetLocale && emittedGetRegion) {
    // Both resolvers emitted — gt-next resolves the locale from next/root-params.
    lines.push(
      'Static rendering preserved: emitted ' +
        `${relative(emittedGetLocale.path)} and ${relative(emittedGetRegion.path)} ` +
        'so gt-next resolves the locale from next/root-params (the [locale] ' +
        'route param) instead of request-scoped headers/cookies — routes that ' +
        'were statically rendered (SSG) stay static (ƒ dynamic otherwise).'
    );
    lines.push('');
  } else if (emittedGetLocale) {
    // Only the locale resolver was emitted; a getRegion file already existed.
    lines.push(
      'Static rendering preserved: emitted ' +
        `${relative(emittedGetLocale.path)} so gt-next resolves the locale from ` +
        'next/root-params (the [locale] route param) instead of request-scoped ' +
        'headers/cookies — routes that were statically rendered (SSG) stay static ' +
        '(ƒ dynamic otherwise). A getRegion file already existed and was left ' +
        'untouched — verify it does not read cookies()/headers(), which would ' +
        'force dynamic rendering (see TODOs).'
    );
    lines.push('');
  } else if (emittedGetRegion) {
    // Only getRegion was emitted; the locale resolver (getLocale) already
    // existed and was left untouched. getRegion returns undefined, so it does
    // not resolve the locale — static rendering hinges on that pre-existing
    // getLocale, which the TODOs flag for verification.
    lines.push(
      'Static rendering: emitted ' +
        `${relative(emittedGetRegion.path)} (it returns undefined, so no ` +
        'request-scoped region read forces dynamic rendering). The locale ' +
        'resolver getLocale already existed and was left untouched — routes that ' +
        'were statically rendered (SSG) stay static only if that file resolves ' +
        'the locale from next/root-params rather than request-scoped ' +
        'headers/cookies; verify it (see TODOs).'
    );
    lines.push('');
  }

  if (ctx.skippedFiles.size > 0) {
    lines.push('## Needs manual migration (files left untouched)');
    lines.push('');
    lines.push(
      `${adapter.displayName} is still installed and ${adapter.providerName ?? 'its provider'} still renders ` +
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
    `- Unknown dictionary keys throw in gt-next (${adapter.displayName} rendered the raw key and logged).`
  );
  lines.push(
    '- Programmatic navigation (redirect, router.push) is not locale-prefixed automatically; <Link> from gt-next/link is.'
  );
  lines.push('');

  lines.push('## Next steps');
  lines.push('');
  const steps: string[] = [];
  if (gtNextMissing) {
    steps.push(
      'Install gt-next — the converted files import it: `npm install gt-next` ' +
        "(or your package manager's equivalent). A non-dry run installs it automatically."
    );
  }
  steps.push('Review the TODOs above, then run your build.');
  steps.push(
    '`npx gt generate` (no API key) or `npx gt translate` (with credentials) to translate new locales.'
  );
  steps.push(
    'Optionally re-run with `--inline` to convert simple strings to inline <T> components.'
  );
  for (const [index, step] of steps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push('');

  return lines.join('\n');
}
