import fs from 'node:fs';
import path from 'node:path';
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
  const adapter = ctx.adapter;
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

  // Honest scope statement for react-i18next: it migrates catalogs + provider +
  // call sites that import useTranslation/Trans DIRECTLY from react-i18next.
  // Wrapper-based call sites (the App Router norm) are left for manual migration
  // (the F4 finding), so the banner must not imply full client coverage.
  if (adapter.id === 'react-i18next') {
    lines.push(
      'Scope: converts i18next catalogs to ICU, swaps the provider and config, ' +
        'and migrates call sites that import useTranslation/Trans directly from ' +
        'react-i18next. Wrapper-based call sites (the official App Router pattern, ' +
        'where components import from a local i18n/client or i18n/server module) ' +
        'are reported and left for manual migration; the server side (getT over ' +
        'i18next) is skipped with a getTranslations recipe.'
    );
    lines.push('');
  }

  // Top-level warnings pulled above the TODO list so they are not lost (the F1
  // finding; also echoed to the console at the end of the run), deduped. The
  // heading's severity follows the adapter: react-i18next raises correctness
  // risks (a [lng] segment renders every non-default locale in the default
  // language), so its section is loud; other adapters raise milder advisories
  // (an assumed default locale, the FormatJS auto-generated-id workflow,
  // flat/nested key collisions), so theirs reads as a plain "Warnings".
  const warnings = [...new Set(ctx.warnings ?? [])];
  if (warnings.length > 0) {
    lines.push(
      adapter.id === 'react-i18next'
        ? '## WARNINGS (read before you build)'
        : '## Warnings'
    );
    lines.push('');
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

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
        '(nested inside GTProvider) so these keep working. Re-run ' +
        `\`gt migrate --from ${adapter.id}\` after converting them to finish ` +
        'the teardown (gt-next is now installed, so auto-detect would pick it).'
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

  // Wrapper transparency (the F2 finding): a component that imports its
  // translation hook from a local wrapper (i18n/client, i18n/server) rather than
  // from react-i18next is silently left unchanged (it has no react-i18next
  // import to key off). Surface those consumers explicitly by listing every file
  // that imports one of the left-unchanged modules, so the untouched call sites
  // are visible instead of appearing done.
  if (adapter.id === 'react-i18next') {
    const consumers = findConsumersOfSkippedFiles(ctx);
    if (consumers.length > 0) {
      lines.push(
        `## Files importing a left-unchanged module (${consumers.length})`
      );
      lines.push('');
      lines.push(
        `${consumers.length} file(s) import one of the modules left unchanged ` +
          'above (your local i18n wrapper / server code). Their call sites still ' +
          'use the old i18n and were NOT migrated; point them at the gt-next ' +
          'equivalents (useTranslations / getTranslations / <T>) by hand.'
      );
      lines.push('');
      for (const { consumer, imports } of consumers) {
        lines.push(
          `- ${relative(consumer)} (imports ${imports
            .map((imp) => relative(imp))
            .join(', ')})`
        );
      }
      lines.push('');
      lines.push(
        'Note: context/plural detection uses call sites that import ' +
          'useTranslation directly from react-i18next; wrapper call sites do not ' +
          'contribute, so context selectors and count-only plurals in those files ' +
          'may have been left literal in the converted catalogs.'
      );
      lines.push('');
    }
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
  // #1909: a migrated app (next-intl, react-intl, or react-i18next alike) does
  // not `next build` on published gt-next until the internal loadDictionary
  // alias fix ships (the default webpack build cannot resolve the generated
  // gt/dictionaries), so steer verification to Turbopack meanwhile — said here
  // at the point of use, not just in a doc the user never opens (the F3 finding).
  steps.push(
    'A migrated app (next-intl, react-intl, or react-i18next alike) will not ' +
      '`next build` on published gt-next until #1909 ships; build with ' +
      '`next build --turbopack` to verify meanwhile.'
  );
  // Only point at the TODOs section when there is one (see above).
  steps.push(
    ctx.todos.length > 0
      ? 'Review the TODOs above, then run your build.'
      : 'Run your build.'
  );
  steps.push(
    '`npx gt generate` (no API key) or `npx gt translate` (with credentials) to translate new locales.'
  );
  for (const [index, step] of steps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push('');

  return lines.join('\n');
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

function stripSourceExtension(file: string): string {
  for (const ext of SOURCE_EXTENSIONS) {
    if (file.endsWith(ext)) return file.slice(0, -ext.length);
  }
  return file;
}

/** Extracts the specifier of every static/dynamic import, re-export, and
 *  require in a source file (best-effort, for the wrapper-consumer report). */
function extractImportSpecifiers(code: string): string[] {
  const specifiers: string[] = [];
  const pattern = /(?:from|import|require)\s*\(?\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

/**
 * Finds every project source file that imports one of the skip+reported files
 * via a relative path. These are the call sites left unchanged because they go
 * through a local wrapper (or import the bespoke server module) rather than
 * react-i18next directly, so the report can name them instead of implying they
 * were migrated.
 */
function findConsumersOfSkippedFiles(
  ctx: MigrationContext
): { consumer: string; imports: string[] }[] {
  const skipped = new Set(ctx.skippedFiles.keys());
  if (skipped.size === 0) return [];
  const byExtless = new Map<string, string>();
  for (const file of skipped) byExtless.set(stripSourceExtension(file), file);

  const projectFiles = ctx.projectFiles ?? ctx.sourceFiles ?? [];
  const results: { consumer: string; imports: string[] }[] = [];
  for (const file of projectFiles) {
    if (skipped.has(file)) continue;
    let code: string;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const hits = new Set<string>();
    for (const specifier of extractImportSpecifiers(code)) {
      if (!specifier.startsWith('.')) continue;
      const resolved = stripSourceExtension(
        path.resolve(path.dirname(file), specifier)
      );
      const match =
        byExtless.get(resolved) ?? byExtless.get(path.join(resolved, 'index'));
      if (match) hits.add(match);
    }
    if (hits.size > 0) {
      results.push({ consumer: file, imports: [...hits] });
    }
  }
  return results;
}
