import fs from 'node:fs';
import path from 'node:path';
import { resolveImportToProjectFiles } from '../pipeline/latentClientCalls.js';
import type { FileEdit, MigrationContext } from '../pipeline/types.js';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
    `# gt migrate report${dryRun ? ' (dry run; nothing written)' : ''}`
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

  const written = ctx.edits.filter((edit) => edit.kind === 'write');
  const deleted = ctx.edits.filter((edit) => edit.kind === 'delete');
  // Post-run content of any project file, read once: the pending edit when this
  // run wrote the file, else what is on disk. Every claim below that depends on
  // the emitted tree (the gt-next/link bullet, the consumers section, the
  // still-referencing sweep) reads through here, so no two of them can disagree
  // about what the tree contains.
  const writtenByPath = new Map(
    written.map((edit) => [edit.path, edit.content ?? ''])
  );
  const deletedPaths = new Set(deleted.map((edit) => edit.path));
  const diskCache = new Map<string, string | null>();
  const postRunContent = (file: string): string | null => {
    if (deletedPaths.has(file)) return null;
    const pending = writtenByPath.get(file);
    if (pending !== undefined) return pending;
    if (diskCache.has(file)) return diskCache.get(file)!;
    let content: string | null;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      content = null; // unreadable or gone outside this run: nothing to claim
    }
    diskCache.set(file, content);
    return content;
  };

  // "Converted" must not take credit for converting a file this run CREATED
  // (the round-9 audit: getLocale.ts, getRegion.ts, loadDictionary.ts and a
  // synthesized gt.config.json never existed before the run). Creation is
  // claimed only on positive evidence, never guessed from a filename:
  //  - an explicit flag from the write site, when one is present;
  //  - a catalog file the adapter synthesized (filesToEmit is documented
  //    new-files-only, never a mutation);
  //  - a source file absent from the PRE-RUN scan sets. Both sets are collected
  //    before anything is written and the transform pass iterates them, so a
  //    source file this run rewrote is always in one of them.
  // Anything without evidence stays under Converted rather than guessing.
  const preRunFiles = new Set([
    ...(ctx.projectFiles ?? []),
    ...(ctx.sourceFiles ?? []),
  ]);
  const synthesizedCatalogs = new Set(
    (ctx.catalogs.filesToEmit ?? []).map((edit) => edit.path)
  );
  const isCreated = (edit: FileEdit): boolean => {
    if ('created' in edit && (edit as { created?: unknown }).created === true) {
      return true;
    }
    if (synthesizedCatalogs.has(edit.path)) return true;
    return /\.[cm]?[jt]sx?$/.test(edit.path) && !preRunFiles.has(edit.path);
  };

  // A rewritten file that still references the source library must never sit
  // under "Converted" (the round-9 request.ts finding): those files get their
  // own section below, and Converted holds only clean conversions.
  const partiallyConverted = written.filter(
    (edit) =>
      typeof edit.content === 'string' &&
      /\.[cm]?[jt]sx?$/.test(edit.path) &&
      adapter.mentionedIn(edit.content)
  );
  const partialSet = new Set(partiallyConverted);
  const rewrittenOrCreated = written.filter((edit) => !partialSet.has(edit));
  const createdFiles = rewrittenOrCreated.filter(isCreated);
  const createdSet = new Set(createdFiles);
  const fullyConverted = rewrittenOrCreated.filter(
    (edit) => !createdSet.has(edit)
  );

  lines.push('## Converted');
  lines.push('');
  if (written.length === 0) {
    lines.push('- (no files changed)');
  } else if (fullyConverted.length === 0 && deleted.length === 0) {
    const because = [
      partiallyConverted.length > 0
        ? `every rewritten file still references ${adapter.displayName} (see the next section)`
        : null,
      createdFiles.length > 0
        ? 'this run only added new files (see Created)'
        : null,
    ].filter((reason): reason is string => reason !== null);
    lines.push(
      `- (none${because.length > 0 ? `; ${because.join('; ')}` : ''})`
    );
  }
  for (const edit of fullyConverted) {
    lines.push(`- ${relative(edit.path)}`);
  }
  for (const edit of deleted) {
    lines.push(`- ${relative(edit.path)} (deleted)`);
  }
  lines.push('');
  lines.push(
    `Existing translations preserved: catalogs in ${relative(ctx.catalogs.dir)}/ ` +
      'now load through loadDictionary.ts; no re-translation needed.'
  );
  lines.push('');

  if (createdFiles.length > 0) {
    lines.push('## Created (new files this run added)');
    lines.push('');
    lines.push(
      'These files did not exist before the run; they are the gt-next wiring it ' +
        'wrote. Nothing in them was converted from ' +
        `${adapter.displayName}:`
    );
    lines.push('');
    for (const edit of createdFiles) {
      lines.push(`- ${relative(edit.path)}`);
    }
    lines.push('');
  }

  if (partiallyConverted.length > 0) {
    lines.push(
      `## Partially converted (still reference ${adapter.displayName})`
    );
    lines.push('');
    lines.push(
      `These files were rewritten by this run and still reference ${adapter.displayName} ` +
        'for the parts it retained (a composed plugin, a retained provider or its ' +
        'request config). They are deliberately not listed under Converted:'
    );
    lines.push('');
    for (const edit of partiallyConverted) {
      lines.push(`- ${relative(edit.path)}`);
    }
    lines.push('');
  }

  // getLocale is the locale resolver (reads next/root-params); getRegion just
  // returns undefined. The report must only credit static rendering to what was
  // actually emitted: when getLocale already existed and was left untouched, the
  // claim hinges on that pre-existing file, not on the getRegion we emitted.
  //
  // Both are matched on the CONTENT the emit phase writes, not on the filename
  // alone (the same class as the navigation sentence below): a project file of
  // its own named getLocale.ts that this run merely converted would otherwise be
  // credited with restoring static rendering it has nothing to do with.
  const emittedGetLocale = written.find(
    (edit) =>
      path.basename(edit.path) === 'getLocale.ts' &&
      (edit.content ?? '').includes("import { locale } from 'next/root-params'")
  );
  const emittedGetRegion = written.find(
    (edit) =>
      path.basename(edit.path) === 'getRegion.ts' &&
      (edit.content ?? '').includes('export default async function getRegion()')
  );
  if (emittedGetLocale && emittedGetRegion) {
    // Both resolvers emitted; gt-next resolves the locale from next/root-params.
    lines.push(
      'Static rendering preserved: emitted ' +
        `${relative(emittedGetLocale.path)} and ${relative(emittedGetRegion.path)} ` +
        'so gt-next resolves the locale from next/root-params (the [locale] ' +
        'route param) instead of request-scoped headers/cookies; routes that ' +
        'were statically rendered (SSG) stay static (ƒ dynamic otherwise).'
    );
    lines.push('');
  } else if (emittedGetLocale) {
    // Only the locale resolver was emitted; a getRegion file already existed.
    lines.push(
      'Static rendering preserved: emitted ' +
        `${relative(emittedGetLocale.path)} so gt-next resolves the locale from ` +
        'next/root-params (the [locale] route param) instead of request-scoped ' +
        'headers/cookies; routes that were statically rendered (SSG) stay static ' +
        '(ƒ dynamic otherwise). A getRegion file already existed and was left ' +
        'untouched; verify it does not read cookies()/headers(), which would ' +
        'force dynamic rendering (see TODOs).'
    );
    lines.push('');
  } else if (emittedGetRegion) {
    // Only getRegion was emitted; the locale resolver (getLocale) already
    // existed and was left untouched. getRegion returns undefined, so it does
    // not resolve the locale; static rendering hinges on that pre-existing
    // getLocale, which the TODOs flag for verification.
    lines.push(
      'Static rendering: emitted ' +
        `${relative(emittedGetRegion.path)} (it returns undefined, so no ` +
        'request-scoped region read forces dynamic rendering). The locale ' +
        'resolver getLocale already existed and was left untouched; routes that ' +
        'were statically rendered (SSG) stay static only if that file resolves ' +
        'the locale from next/root-params rather than request-scoped ' +
        'headers/cookies; verify it (see TODOs).'
    );
    lines.push('');
  }

  // Claim the retained provider only when a written edit actually renders it: a
  // project that never rendered one (a bespoke server-side setup) keeps working
  // through the retained package alone, and naming a provider there would be
  // false. Conservative by design; a provider living only in a skipped
  // (unwritten) file just goes unmentioned. Two sections read this: the skip
  // section's "these keep working" and the payload-size behavior difference,
  // which additionally needs the provider to be handed its own messages.
  const providerEdit =
    adapter.providerName === null
      ? undefined
      : written.find((edit) =>
          (edit.content ?? '').includes(`<${adapter.providerName}`)
        );
  const providerRetained = providerEdit !== undefined;
  const providerCarriesMessages =
    providerEdit !== undefined &&
    new RegExp(
      `<${escapeRegExp(adapter.providerName ?? '')}\\b[^>]*\\bmessages\\b`
    ).test(providerEdit.content ?? '');

  // Test files render in their own section below with the migration recipe;
  // listing them anywhere else double-reports them.
  const testFileSet = new Set(ctx.testFilesNeedingMigration ?? []);

  if (ctx.skippedFiles.size > 0) {
    lines.push('## Needs manual migration (files left untouched)');
    lines.push('');
    lines.push(
      `${adapter.displayName} is still installed` +
        (providerRetained
          ? ` and ${adapter.providerName} still renders (nested inside GTProvider)`
          : '') +
        ' so these keep working. Re-run ' +
        `\`gt migrate --from ${adapter.id}\` after converting them to finish ` +
        'the teardown.'
    );
    lines.push('');
    for (const [file, reasons] of ctx.skippedFiles) {
      if (testFileSet.has(file)) continue;
      lines.push(`- ${relative(file)}`);
      for (const reason of reasons) {
        lines.push(`  - ${reason}`);
      }
    }
    lines.push('');
  }

  // The explicit test stage (round-7 P2): converted components now call
  // gt-next APIs, so suites whose setup/render helpers/mocks still wire the
  // source library FAIL until those are migrated by hand. No codemod can
  // follow a vi.mock()/jest.mock() of the source module or an IntlProvider
  // render helper, so this is called out as a blocking manual step instead of
  // being buried among generic skips. The list includes suites the driver
  // reached through the test-import closure (they render through a flagged
  // helper and carry no reference of their own), so each entry states its own
  // evidence: a user has to know whether to edit an import, a mock, or a
  // helper this file shares.
  const testFiles = ctx.testFilesNeedingMigration ?? [];
  if (testFiles.length > 0) {
    // The heading states the action, not a blanket prediction: one shape of
    // flagged file can still pass (a mock of a module every consumer of which
    // this run held), and asserting otherwise would be a claim about the
    // user's suite that nothing here measured. The stakes stay in the body,
    // bounded by that exception.
    lines.push(
      '## Tests need manual migration (run these suites before calling the migration done)'
    );
    lines.push('');
    // The count is of FILES needing a hand migration, which is what this list
    // holds; the failure prediction is scoped to the collected suites among
    // them. A config-wired setup file is not itself a suite (vitest/jest never
    // collect it), so "N files -> N failing suites" would overstate the count by
    // every such file (the round-9 audit finding on the run-level warning).
    lines.push(
      `${testFiles.length} test file(s) depend on ${adapter.displayName} test ` +
        'wiring (setup files, render helpers, provider wrappers, module ' +
        'mocks), or import another test file that does. The components and ' +
        'modules they exercise now call gt-next APIs, so the collected suites ' +
        'WILL fail until that wiring is migrated, unless every part of the app ' +
        'a file touches was left untouched by this run (a mock of a module ' +
        'whose consumers were all skipped still intercepts). A file your test ' +
        'runner wires by config (a setup file) is not collected as a suite ' +
        'itself: its breakage surfaces in the suites it wires:'
    );
    lines.push('');
    for (const file of testFiles) {
      lines.push(`- ${relative(file)}`);
      const evidence = testFileEvidence(ctx, file);
      if (evidence) lines.push(`  - ${evidence}`);
    }
    lines.push('');
    // next-intl is the only source here with a documented server subpath users
    // mock (next-intl/server); the others have no equivalent entry to name.
    const mockedServerModule =
      adapter.id === 'next-intl'
        ? '`next-intl/server`'
        : `${adapter.displayName}'s server-side entry`;
    lines.push(
      'Migrate them by hand: swap module mocks from ' +
        `${adapter.displayName} to gt-next (mock \`useTranslations\` to return ` +
        'a lookup into your catalogs), and replace provider-based render ' +
        `helpers (a unit-test render generally should not mount gt-next's ` +
        'server-side GTProvider). One case needs more than a rename: a suite ' +
        `that mocked ${mockedServerModule} must mock \`gt-next/server\` ` +
        'instead. Loading it for real under vitest fails with `Cannot find ' +
        "package 'server-only'`, which drops the whole suite at collection " +
        '(vitest reports that as a failed *suite*, so the tests it contains ' +
        'disappear from the count rather than showing up as failures). Run ' +
        'the suites before calling the migration done.'
    );
    lines.push('');
  }

  // Wrapper transparency: a file that reaches the old i18n through a LOCAL
  // module this run left unchanged (a react-i18next i18n/client wrapper, a
  // next-intl createNavigation wrapper) has no source-library import of its own,
  // so nothing converts it and the post-run sweep cannot see it either (it
  // references the wrapper, not the library). Left silent, such a file reads as
  // done under "Converted" while its hook or its Link/useRouter/redirect still
  // run through the old library. Every adapter has this shape (the round-9
  // audit: 19 files kept importing a retained next-intl navigation wrapper while
  // this section was gated to react-i18next), so it is listed for all of them.
  // A flagged test file that imports a flagged helper is already listed, with
  // its own recipe, in the test stage above; naming it here too would report it
  // twice.
  const consumers = findConsumersOfSkippedFiles(ctx, postRunContent).filter(
    ({ consumer }) => !testFileSet.has(consumer)
  );
  if (consumers.length > 0) {
    lines.push(
      `## Files importing a left-unchanged module (${consumers.length})`
    );
    lines.push('');
    lines.push(
      `${consumers.length} file(s) import one of the modules left unchanged ` +
        'above. Whatever they use from that module (a translation hook, ' +
        `Link/useRouter/redirect) still runs through ${adapter.displayName}, ` +
        'including for files listed under Converted, whose OWN ' +
        `${adapter.displayName} imports were converted. Point those uses at the ` +
        'gt-next equivalents (useTranslations / getTranslations / <T> / ' +
        'gt-next/link) by hand, or migrate the module they import and re-run ' +
        `\`gt migrate --from ${adapter.id}\`.`
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
    if (adapter.id === 'react-i18next') {
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
      lines.push(`- ${location}; ${todo.reason}`);
    }
    lines.push('');
  }

  lines.push('## Behavior differences to know about');
  lines.push('');
  lines.push(
    `- Unknown dictionary keys throw in gt-next (${adapter.displayName} rendered the raw key and logged).`
  );
  // Both halves of the navigation sentence are gated on the emitted tree, not on
  // a proxy. The router half keys off the CONTENT the navigation transform
  // generates, never the emitted filename: the companion module is named after
  // the wrapper's own basename, so a wrapper at i18n/nav.ts emits
  // i18n/nav.client.ts and a filename test would miss it and print the blanket
  // sentence over a tree whose router.push IS prefixed (the round-9 code
  // adversary finding).
  const routerWrapped = written.some((edit) => {
    const content = edit.content ?? '';
    return (
      content.includes('export function useRouter()') &&
      content.includes('localizeHref(href, locale)')
    );
  });
  // The <Link> half asserts gt-next/link behavior, so it only ships when the
  // emitted tree actually imports gt-next/link. A next-intl run that holds the
  // navigation wrapper (its call sites use locale-aware signatures) emits no
  // such import, and the tree's links are prefixed by the retained library
  // instead.
  const gtLinkImportPattern = /['"]gt-next\/link['"]/;
  const gtLinkImported =
    written.some((edit) => gtLinkImportPattern.test(edit.content ?? '')) ||
    (ctx.projectFiles ?? []).some((file) =>
      gtLinkImportPattern.test(postRunContent(file) ?? '')
    );
  const linkClause = gtLinkImported
    ? ' <Link> from gt-next/link is prefixed.'
    : '';
  lines.push(
    routerWrapped
      ? '- Server redirects (redirect, permanentRedirect) are not locale-prefixed automatically; the generated navigation wrapper keeps useRouter().push/replace/prefetch prefixed.' +
          linkClause
      : '- Programmatic navigation (redirect, router.push) is not locale-prefixed automatically.' +
          linkClause
  );
  // Retaining the source library's provider keeps two i18n payloads in the
  // page. Measured shape (round-9 audit, one real app): no prerendered page was
  // byte-identical after the run and each grew by roughly the size of the
  // catalog file(s) that page renders with. Stated only when a written edit both
  // renders the provider AND hands it messages, and sized in catalog-file terms
  // rather than a number this run never measured for the user's app.
  if (providerCarriesMessages) {
    lines.push(
      `- Both catalogs ship in every page while ${adapter.providerName} still ` +
        "renders: gt-next's dictionary and the messages you pass that provider " +
        'are each serialized into the page, so a prerendered page carries ' +
        'roughly one extra catalog file worth of HTML. Finishing the teardown ' +
        '(convert the files listed above, then re-run ' +
        `\`gt migrate --from ${adapter.id}\`) removes the duplicate payload.`
    );
  }
  lines.push('');

  // No post-run source-library reference may go unnamed (the round-9 audit
  // lesson: this report is judged against the emitted tree, and silence about
  // a file that still references the library reads as a false "fully
  // converted"). Sweep every project file's post-run content; anything still
  // referencing the library and not already named above gets its own section.
  const namedSoFar = lines.join('\n');
  // Both edges of the path have to be bounded. The right edge stops `foo.ts`
  // from matching inside `foo.tsx`; the left edge stops `lib/meta.ts` from
  // matching inside `src/lib/meta.ts`, which used to make a root-level file that
  // still references the library disappear from the report entirely (the round-9
  // code adversary finding). Path characters ('/', '\', word chars, '.', '-')
  // may not sit immediately left of the match; list punctuation and quotes may.
  const isNamed = (rel: string) =>
    new RegExp(`(?<![\\w./\\\\-])${escapeRegExp(rel)}(?![\\w.])`).test(
      namedSoFar
    );
  const stillReferencing: string[] = [];
  for (const file of ctx.projectFiles ?? []) {
    const content = postRunContent(file);
    if (content === null) continue;
    if (!adapter.mentionedIn(content)) continue;
    if (isNamed(relative(file))) continue;
    stillReferencing.push(relative(file));
  }
  if (stillReferencing.length > 0) {
    lines.push(`## Still referencing ${adapter.displayName}`);
    lines.push('');
    lines.push(
      `These files still reference ${adapter.displayName} after the migration and no ` +
        'section above covers them. Nothing in them was changed: they are retained ' +
        `wiring (imported by files this run kept on ${adapter.displayName}) or ` +
        'references the migration does not touch. Verify each is still needed by a ' +
        'retained file, or migrate it by hand and re-run gt migrate:'
    );
    lines.push('');
    for (const file of stillReferencing.sort()) {
      lines.push(`- ${file}`);
    }
    lines.push('');
  }

  lines.push('## Next steps');
  lines.push('');
  const steps: string[] = [];
  if (gtNextMissing) {
    steps.push(
      'Install gt-next; the converted files import it: `npm install gt-next` ' +
        "(or your package manager's equivalent). A non-dry run installs it " +
        'automatically when it can detect your package manager.'
    );
  }
  // The internal loadDictionary alias fix (#1909) shipped in gt-next 11.1.0;
  // on older published versions the default webpack build cannot resolve the
  // generated gt/dictionaries, so steer those to Turbopack; said here at the
  // point of use, not just in a doc the user never opens (the F3 finding).
  steps.push(
    'Webpack `next build` needs gt-next >= 11.1.0; on an older gt-next, ' +
      'build with `next build --turbopack` or upgrade.'
  );
  // Only point at the TODOs section when there is one (see above).
  steps.push(
    ctx.todos.length > 0
      ? 'Review the TODOs above, then run your build.'
      : 'Run your build.'
  );
  // The dictionary this run wired lives where the catalogs do, and the gt CLI
  // does not read it from gt.config.json or next.config: it takes --dictionary,
  // or a conventional ./dictionary.{js,ts,json}. Measured on a migrated app:
  // bare `npx gt generate` prints "No inline content or dictionaries were found"
  // and writes 2-byte `{}` catalogs, while the same command with --dictionary
  // writes the full source template. So the step names the flag with the real
  // path instead of a command that cannot work on the tree this run emitted.
  const dictionaryPath = relative(
    path.join(ctx.catalogs.dir, `${ctx.catalogs.defaultLocale}.json`)
  )
    .split(path.sep)
    .join('/');
  steps.push(
    `\`npx gt generate --dictionary ${dictionaryPath}\` (no API key) or ` +
      `\`npx gt translate --dictionary ${dictionaryPath}\` (with credentials) ` +
      'to translate new locales. The flag is required: this migration keeps your ' +
      'strings in a dictionary (not inline <T> content), and the gt CLI looks ' +
      'for one only there or at a conventional ./dictionary.{js,ts,json} path, ' +
      'not in gt.config.json or next.config. Without it both commands report ' +
      '"No inline content or dictionaries were found" and write empty catalogs.'
  );
  for (const [index, step] of steps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Why a flagged test file is in the stage, and therefore which edit it needs:
 * a real import of the source library, a module mock that names it as a bare
 * string (vi.mock/jest.mock; the mock stops intercepting the moment the
 * components under test are converted), or neither, which means it reached the
 * stage through another flagged test file it imports (a shared render helper).
 *
 * Measured from the file's current content rather than recorded during the
 * scan: test files are never written by a migration, so this reads the same
 * bytes the scan classified, and the report cannot drift from what the file
 * actually contains. An unreadable file gets no evidence line instead of a
 * guessed one.
 */
function testFileEvidence(ctx: MigrationContext, file: string): string | null {
  const adapter = ctx.adapter;
  // Evidence recorded at the classification site wins: a suite flagged for
  // importing converted code has no source-library reference of its own, so
  // deriving from content below would mislabel it as a helper importer.
  const recorded = ctx.testFileEvidence?.get(file);
  if (recorded) return recorded;
  let code: string;
  try {
    code = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  if (adapter.projectUsagePattern.test(code)) {
    return `imports ${adapter.displayName} directly`;
  }
  if (adapter.mentionedIn(code)) {
    return (
      `mocks ${adapter.displayName} (vi.mock/jest.mock); the mock no longer ` +
      'intercepts converted components'
    );
  }
  return (
    'imports a test file listed here (a shared setup or render helper); its ' +
    `${adapter.displayName} wiring no longer intercepts what this suite renders`
  );
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
 * Finds every project source file that imports one of the skip+reported files.
 * These are the call sites left unchanged because they reach the old i18n
 * through a local module (a react-i18next i18n/client wrapper, a next-intl
 * createNavigation wrapper) rather than through the library directly, so the
 * report can name them instead of implying they were migrated.
 *
 * Specifiers resolve the same way the rest of the pipeline resolves them
 * (relative, '@/x'-style aliases, baseUrl-relative), because a path alias is the
 * App Router norm: the round-9 audit found 19 files importing a retained
 * next-intl wrapper as '@/i18n/navigation', which a relative-only match saw as
 * zero consumers. Suffix matching can be ambiguous, so a specifier that resolves
 * to more than one project file counts only when EVERY candidate is a skipped
 * file (an ambiguous specifier must not manufacture a consumer).
 *
 * Reads post-run content, so a file this run rewrote is judged by what it will
 * actually contain on disk.
 */
function findConsumersOfSkippedFiles(
  ctx: MigrationContext,
  postRunContent: (file: string) => string | null
): { consumer: string; imports: string[] }[] {
  const skipped = new Set(ctx.skippedFiles.keys());
  if (skipped.size === 0) return [];

  const projectFiles = ctx.projectFiles ?? ctx.sourceFiles ?? [];
  const fileSet = new Set(projectFiles);
  // A skipped file outside the project scan still has to be matchable.
  for (const file of skipped) fileSet.add(file);
  const resolutionFiles = [...fileSet];
  const results: { consumer: string; imports: string[] }[] = [];
  for (const file of projectFiles) {
    if (skipped.has(file)) continue;
    const code = postRunContent(file);
    if (code === null) continue;
    const hits = new Set<string>();
    for (const specifier of extractImportSpecifiers(code)) {
      const candidates = resolveImportToProjectFiles(
        specifier,
        path.dirname(file),
        fileSet,
        resolutionFiles
      );
      if (candidates.length === 0) continue;
      if (!candidates.every((candidate) => skipped.has(candidate))) continue;
      for (const candidate of candidates) hits.add(candidate);
    }
    if (hits.size > 0) {
      results.push({ consumer: file, imports: [...hits].sort() });
    }
  }
  return results;
}
