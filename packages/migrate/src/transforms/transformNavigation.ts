import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { packageNameOf } from './importUtils.js';
import { localePrefixHasCustomPrefixes } from '../config/parseRoutingConfig.js';
import type {
  MigrationContext,
  SourceResult,
  TodoEntry,
} from '../pipeline/types.js';

/** Destructured names we can replace with equivalent behavior. */
const NEXT_NAVIGATION_EXPORTS = new Set([
  'redirect',
  'permanentRedirect',
  'usePathname',
  'useRouter',
]);

/** Locale tags safe to inline into the generated module as string literals. */
const SAFE_LOCALE_TAG = /^[A-Za-z0-9_-]+$/;

/**
 * Rewrites the thin `createNavigation(routing)` wrapper module so every
 * existing `import { Link } from '@/i18n/navigation'` in the app keeps
 * compiling: Link becomes gt-next's locale-aware Link, usePathname becomes a
 * locale-stripping wrapper (next-intl's returns the pathname WITHOUT the
 * prefix), useRouter becomes a locale-prefixing wrapper (next-intl's router
 * prefixed every root-relative href), the rest re-export from next/navigation.
 * Anything beyond that shape; including localized `pathnames` routing; is left
 * for manual work.
 */
export function transformNavigationFile(
  file: string,
  code: string,
  ctx: MigrationContext
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
  };
  // Cheap pre-filter only; correctness comes from the AST import check below.
  if (!code.includes('createNavigation')) return none;

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (error) {
    return {
      ...none,
      skipReasons: [`file could not be parsed: ${String(error)}`],
    };
  }

  // The string 'createNavigation' is meaningless unless it is really imported
  // from next-intl/navigation. Resolve the local binding (alias-aware) so an
  // unrelated helper or a bare comment mention falls through to the generic
  // source pass instead of being silently swallowed here.
  const createNavLocal = findCreateNavigationLocal(ast);
  if (createNavLocal === null) return none;

  // Localized pathnames (`/fr/a-propos`) have no gt-next equivalent, so
  // converting would silently de-localize every href. Treat an unresolved
  // pathnames config (a variable or computed value) the same way rather than
  // risk de-localizing routes we could not read.
  if (ctx.routing.pathnames) {
    return {
      ...none,
      skipReasons: [
        'routing config defines localized pathnames, which gt-next navigation does not support; keep next-intl navigation for these routes (manual conversion)',
      ],
    };
  }
  if (ctx.routing.pathnamesUnresolved) {
    return {
      ...none,
      skipReasons: [
        'routing config pathnames could not be statically resolved, so they are treated as localized pathnames; keep next-intl navigation and convert this file manually',
      ],
    };
  }

  const destructured: string[] = [];
  let sawCreateNavigation = false;
  let extraStatements = false;

  for (const statement of ast.program.body) {
    if (t.isImportDeclaration(statement)) continue;
    const declaration = t.isExportNamedDeclaration(statement)
      ? statement.declaration
      : statement;
    if (
      t.isVariableDeclaration(declaration) &&
      declaration.declarations.length === 1
    ) {
      const declarator = declaration.declarations[0];
      const init = declarator.init;
      if (
        init &&
        t.isCallExpression(init) &&
        t.isIdentifier(init.callee, { name: createNavLocal }) &&
        t.isObjectPattern(declarator.id)
      ) {
        sawCreateNavigation = true;
        for (const property of declarator.id.properties) {
          if (
            t.isObjectProperty(property) &&
            t.isIdentifier(property.key) &&
            !property.computed
          ) {
            destructured.push(property.key.name);
          } else {
            return {
              ...none,
              skipReasons: ['navigation wrapper uses an unsupported pattern'],
            };
          }
        }
        continue;
      }
    }
    extraStatements = true;
  }

  if (!sawCreateNavigation) {
    // The import is real but the wrapper is not the destructured shape we can
    // rewrite (an identifier binding, a default-exported call, and so on).
    // Skip so teardown is held back rather than uninstalling next-intl out
    // from under a file that still imports next-intl/navigation.
    return {
      ...none,
      skipReasons: [
        'createNavigation wrapper has an unrecognized shape and was left on next-intl (manual conversion); this file holds back full teardown until converted',
      ],
    };
  }
  if (extraStatements) {
    return {
      ...none,
      skipReasons: [
        'navigation wrapper contains extra statements (manual conversion)',
      ],
    };
  }
  const unsupported = destructured.filter(
    (name) => name !== 'Link' && !NEXT_NAVIGATION_EXPORTS.has(name)
  );
  if (unsupported.length > 0) {
    return {
      ...none,
      skipReasons: [
        `navigation wrapper destructures ${unsupported.join(', ')} which has no drop-in gt-next equivalent (manual conversion)`,
      ],
    };
  }

  // While any caller still uses next-intl's locale-aware programmatic
  // signatures (router.replace(href, { locale }), redirect({ href, locale })),
  // swapping this wrapper's useRouter/redirect for next/navigation
  // passthroughs rewrites the API out from under those call sites: the object
  // arguments fail TypeScript, redirect stringifies to /[object Object], and
  // locale selectors no-op (the round-7 PlantPal/Sniply/AutoHack failures).
  // The callers themselves were already skipped (see the driver's
  // locale-aware-navigation scan); holding the wrapper keeps them working
  // against the library that understands their signatures.
  const navCallers = ctx.localeAwareNavCallers ?? [];
  if (navCallers.length > 0) {
    const examples = navCallers
      .slice(0, 3)
      .map((caller) => path.relative(ctx.cwd, caller))
      .join(', ');
    return {
      ...none,
      skipReasons: [
        `${navCallers.length} file(s) still call navigation with next-intl's locale-aware signatures (${examples}); the wrapper stays on next-intl so they keep working; convert those call sites manually, then re-run gt migrate`,
      ],
    };
  }

  // Programmatic navigation: next-intl's createNavigation router prefixed
  // every root-relative href with the active locale, next/navigation's does
  // not, and gt-next ships no router at all, so re-exporting next/navigation's
  // useRouter silently de-prefixes every push/replace/prefetch in the app (the
  // round-9 memo-engine finding: three call sites, no build error, a
  // middleware redirect round trip and a cookie-chosen locale at runtime). The
  // companion client module below generates a prefixing wrapper instead. The
  // prefix rule depends entirely on localePrefix, so an unreadable one holds
  // the file rather than guessing the app's public URL structure; same call
  // transformMiddleware makes for the same reason.
  const wantsRouter = destructured.includes('useRouter');
  // next-intl defaults localePrefix to 'always'.
  const prefixMode = ctx.routing.localePrefix ?? 'always';
  if (wantsRouter && prefixMode !== 'never') {
    if (ctx.routing.localePrefixUnresolved) {
      return {
        ...none,
        skipReasons: [
          "localePrefix could not be statically resolved (it references a variable, a computed value, or a spread that cannot be read statically), so a locale-prefixing useRouter would guess the app's public URL structure; inline a literal localePrefix in defineRouting (or convert this wrapper by hand) and rerun the migration. The retained file still imports next-intl/navigation and holds back full teardown",
        ],
      };
    }
    if (prefixMode === 'as-needed' && !ctx.routing.defaultLocale) {
      return {
        ...none,
        skipReasons: [
          "localePrefix 'as-needed' prefixes every locale except the default one, but defaultLocale could not be statically resolved, so a useRouter wrapper cannot tell which locale is served unprefixed; inline a literal defaultLocale in defineRouting (or convert this wrapper by hand) and rerun the migration. The retained file still imports next-intl/navigation and holds back full teardown",
        ],
      };
    }
  }
  // Under 'never' nothing was prefixed, so the plain next/navigation
  // passthrough is already behavior-identical and no wrapper is generated.
  const wrapsRouter = wantsRouter && prefixMode !== 'never';

  // The generated module deliberately has no 'use client' directive, same
  // as the next-intl createNavigation file it replaces: a shared module's
  // hooks work when imported from client components, and a directive here
  // would turn the Link re-export into a client reference for server
  // importers.
  // Pre-existing side-effect imports (`import 'server-only'`) carry meaning
  // the regenerated wrapper must keep; reconstruct them at the top verbatim.
  // One importing the library being torn down would dangle after teardown, so
  // that holds the file instead.
  const sideEffectImports = ast.program.body.filter(
    (statement): statement is t.ImportDeclaration =>
      t.isImportDeclaration(statement) &&
      statement.specifiers.length === 0 &&
      // `import type {} from 'x'` is erased at build time; reconstructing it
      // would invent a runtime side-effect import.
      statement.importKind !== 'type'
  );
  const ownedSideEffect = sideEffectImports.find((declaration) =>
    ctx.adapter.teardownPackages.includes(
      packageNameOf(declaration.source.value)
    )
  );
  if (ownedSideEffect) {
    return {
      ...none,
      skipReasons: [
        `side-effect import of '${ownedSideEffect.source.value}' would break once ${ctx.adapter.displayName} is removed (convert it manually)`,
      ],
    };
  }

  const lines: string[] = [];
  for (const declaration of sideEffectImports) {
    lines.push(`import '${declaration.source.value}';`);
  }
  if (sideEffectImports.length > 0) lines.push('');
  const wrapsPathname = destructured.includes('usePathname');
  const passthrough = destructured.filter(
    (name) =>
      NEXT_NAVIGATION_EXPORTS.has(name) &&
      name !== 'usePathname' &&
      !(name === 'useRouter' && wrapsRouter)
  );
  const isTypeScriptWrapper = /\.(ts|tsx|mts|cts)$/.test(file);

  if (destructured.includes('Link')) {
    if (isTypeScriptWrapper) {
      // gt-next/link currently publishes its component typed as
      // ForwardRefExoticComponent<any>; the `any` erases prop typing at every
      // call site, so an onClick handler's parameter becomes implicit any and
      // fails strict builds (the round-7 Sniply failure). Its props are
      // next/link's (plus runtime locale handling), so re-export it under
      // next/link's concrete type until gt-next ships typed props.
      lines.push("import GTLink from 'gt-next/link';");
      lines.push("import type NextLink from 'next/link';");
      lines.push('');
      lines.push(
        '// gt-next/link ships untyped props (ForwardRefExoticComponent<any>),'
      );
      lines.push(
        "// which breaks contextual typing at call sites; next/link's type is"
      );
      lines.push('// the accurate one for it.');
      lines.push('export const Link = GTLink as unknown as typeof NextLink;');
    } else {
      lines.push("export { default as Link } from 'gt-next/link';");
    }
  }
  if (passthrough.length > 0) {
    lines.push(`export { ${passthrough.join(', ')} } from 'next/navigation';`);
  }
  if (wrapsPathname || wrapsRouter) {
    // The usePathname/useRouter wrappers call client-only hooks, but this
    // module is also imported by Server Components (a server page importing
    // Link), so the hook bodies must live behind their own 'use client'
    // boundary; a directive-less module with hook imports fails the RSC build
    // the moment a server file imports anything from it.
    const extension = path.extname(file);
    const base = path.basename(file, extension);
    const clientBase = `${base}.client`;
    const clientPath = path.join(path.dirname(file), clientBase + extension);
    // Check every JS/TS extension, not just the wrapper's own: a sibling
    // `navigation.client.tsx` would make the `./navigation.client` specifier
    // ambiguous even though the exact emitted path is free.
    const collides = ['.ts', '.tsx', '.js', '.jsx'].some((ext) => {
      const candidate = path.join(path.dirname(file), clientBase + ext);
      return (
        fs.existsSync(candidate) ||
        ctx.edits.some((edit) => edit.path === candidate)
      );
    });
    if (collides) {
      const needed = [
        wrapsPathname ? 'usePathname' : null,
        wrapsRouter ? 'useRouter' : null,
      ]
        .filter((name): name is string => name !== null)
        .join('/');
      return {
        ...none,
        skipReasons: [
          `converting ${needed} needs a companion client module at ${clientBase}${extension}, but that file already exists; convert this navigation wrapper manually`,
        ],
      };
    }
    ctx.edits.push({
      path: clientPath,
      kind: 'write',
      content: buildNavigationClientModule({
        wrapsPathname,
        wrapsRouter,
        typed: isTypeScriptWrapper,
        locales: prefixLocales(ctx),
        unprefixedLocale:
          prefixMode === 'as-needed' ? ctx.routing.defaultLocale : null,
      }),
    });
    const clientExports = [
      wrapsPathname ? 'usePathname' : null,
      wrapsRouter ? 'useRouter' : null,
    ].filter((name): name is string => name !== null);
    lines.push(
      `export { ${clientExports.join(', ')} } from './${clientBase}';`
    );
  }

  const todos: TodoEntry[] = [];
  // Per-locale URL prefixes (localePrefix.prefixes) have no gt-next
  // equivalent: the middleware transform drops them, so the migrated app
  // serves /<locale> and the generated router prefixes to match. Say so here
  // too, because an app whose middleware was skipped (extra logic) keeps
  // serving the custom prefixes while this wrapper targets /<locale>.
  if (wrapsRouter && localePrefixHasCustomPrefixes(ctx.routing.routingFile)) {
    todos.push({
      file,
      reason:
        'the generated useRouter prefixes hrefs with /<locale>, but this app configures localePrefix.prefixes (per-locale URL prefixes), which gt-next has no equivalent for; the converted middleware drops them, so verify the URLs your app actually serves (especially if the middleware was skipped and still applies the custom prefixes)',
    });
  }
  // redirect/permanentRedirect keep the passthrough: they are synchronous
  // server functions and every gt-next locale accessor (including the
  // migrator's own generated getLocale) is async, so no drop-in prefixing
  // wrapper exists. Under 'never' nothing was prefixed and there is nothing to
  // report; otherwise name the call sites that actually lose the prefix rather
  // than filing one unactionable note against the wrapper.
  const redirects = passthrough.filter((name) => name !== 'useRouter');
  if (redirects.length > 0 && prefixMode !== 'never') {
    for (const site of findWrapperRedirectCallSites(file, ctx)) {
      todos.push({
        file: site.file,
        line: site.line,
        reason: `${site.callee}() here comes from the converted navigation wrapper, which is plain next/navigation now; next-intl prefixed the target with the active locale, so add the locale prefix by hand where this route needs one (gt-next has no synchronous locale-prefixing redirect)`,
      });
    }
    lines.push('');
    lines.push(
      `// TODO(gt-migrate): ${redirects.join('/')} ${redirects.length > 1 ? 'are' : 'is'} plain next/navigation now, so`
    );
    lines.push(
      '// the target is no longer locale-prefixed (gt-next locale accessors are'
    );
    lines.push(
      '// async, so there is no drop-in prefixing wrapper). Add the prefix by'
    );
    lines.push('// hand where a locale path is required.');
  }
  if (passthrough.includes('useRouter')) {
    // localePrefix 'never': the passthrough IS the previous behavior, so this
    // is a note and not a TODO. It records why useRouter is a bare re-export
    // here while other apps get a prefixing wrapper.
    lines.push('');
    lines.push(
      "// localePrefix 'never' prefixed no hrefs, so useRouter stays a plain"
    );
    lines.push('// next/navigation re-export.');
  }

  return {
    code: lines.join('\n') + '\n',
    todos,
    skipReasons: [],
  };
}

/** Locales that may legitimately appear as an href's first segment. Routing is
 *  the authority; the catalog set is the fallback when defineRouting's locales
 *  could not be read statically. */
function prefixLocales(ctx: MigrationContext): string[] {
  const locales =
    ctx.routing.locales && ctx.routing.locales.length > 0
      ? ctx.routing.locales
      : ctx.catalogs.locales;
  // A tag that cannot be inlined as a plain string literal would emit a broken
  // module; drop it (the double-prefix guard also tests the active locale).
  return locales.filter((locale) => SAFE_LOCALE_TAG.test(locale));
}

/**
 * The companion 'use client' module the wrapper re-exports its hooks from.
 * usePathname strips the locale prefix (next-intl's returned it unprefixed);
 * useRouter adds it back on push/replace/prefetch (next-intl's prefixed every
 * root-relative href), mirroring next-intl's applyPathnamePrefix +
 * prefixPathname: only local, non-relative hrefs, no trailing slash for '/'
 * and '/?query', and back/forward/refresh untouched. Emitted with type
 * annotations only for a TypeScript wrapper; a JS wrapper gets the same code
 * without them.
 */
function buildNavigationClientModule(options: {
  wrapsPathname: boolean;
  wrapsRouter: boolean;
  typed: boolean;
  locales: string[];
  /** the locale served without a prefix ('as-needed'), else null */
  unprefixedLocale: string | null;
}): string {
  const { wrapsPathname, wrapsRouter, typed, locales, unprefixedLocale } =
    options;
  const ts = (annotation: string) => (typed ? annotation : '');
  const lines: string[] = ["'use client';", ''];

  const nextImports = [
    wrapsPathname ? 'usePathname as useNextPathname' : null,
    wrapsRouter ? 'useRouter as useNextRouter' : null,
  ].filter((specifier): specifier is string => specifier !== null);
  if (nextImports.length === 1) {
    lines.push(`import { ${nextImports[0]} } from 'next/navigation';`);
  } else {
    lines.push('import {');
    for (const specifier of nextImports) lines.push(`  ${specifier},`);
    lines.push("} from 'next/navigation';");
  }
  lines.push("import { useLocale } from 'gt-next';");
  if (wrapsRouter) lines.push("import { useMemo } from 'react';");
  lines.push('');

  if (wrapsPathname) {
    lines.push(
      "// next-intl's usePathname returns the pathname without the locale",
      "// prefix; next/navigation's includes it. Strip it to stay",
      '// drop-in for existing callers.',
      'export function usePathname() {',
      '  const pathname = useNextPathname();',
      '  const locale = useLocale();',
      '  const prefix = `/${locale}`;',
      "  if (pathname === prefix) return '/';",
      '  return pathname.startsWith(`${prefix}/`)',
      '    ? pathname.slice(prefix.length)',
      '    : pathname;',
      '}',
      ''
    );
  }

  if (wrapsRouter) {
    lines.push(
      '// Locales this app serves, so an href a call site already prefixed by',
      '// hand is not prefixed twice.',
      `const LOCALES = [${locales.map((locale) => `'${locale}'`).join(', ')}];`
    );
    if (unprefixedLocale) {
      lines.push(
        "// localePrefix 'as-needed': the default locale is served unprefixed.",
        `const DEFAULT_LOCALE = '${unprefixedLocale}';`
      );
    }
    lines.push(
      '',
      "// next-intl's useRouter prefixed every root-relative href with the",
      '// active locale; next/navigation does not and gt-next ships no router,',
      '// so the prefix is applied here to keep existing call sites navigating',
      '// to the same URLs.',
      `function localizeHref(href${ts(': string')}, locale${ts(': string')})${ts(': string')} {`,
      '  // Only root-relative paths are locale-scoped: external URLs, hashes',
      '  // and relative paths resolve against the current URL, which already',
      '  // carries the prefix.',
      "  if (!href.startsWith('/')) return href;"
    );
    if (unprefixedLocale) {
      lines.push('  if (locale === DEFAULT_LOCALE) return href;');
    }
    lines.push(
      "  const firstSegment = /^\\/([^/?#]*)/.exec(href)?.[1] ?? '';",
      '  if (firstSegment === locale || LOCALES.includes(firstSegment)) {',
      '    return href;',
      '  }',
      "  // '/' and '/?query' must not gain a trailing slash.",
      '  const suffix = /^\\/(\\?.*)?$/.test(href) ? href.slice(1) : href;',
      '  return `/${locale}${suffix}`;',
      '}',
      '',
      'export function useRouter() {',
      '  const router = useNextRouter();',
      '  const locale = useLocale();',
      "  // Memoized like next-intl's router: an effect with [router] in its",
      '  // dependency array must not re-run on every render.',
      '  return useMemo(() => {'
    );
    if (typed) {
      // Derived per method: next/navigation types prefetch's options as
      // PrefetchOptions (with a required `kind`), not push's NavigateOptions,
      // so one shared alias fails a strict build.
      lines.push(
        '    type NavigateOptions = Parameters<typeof router.push>[1];',
        '    type PrefetchOptions = Parameters<typeof router.prefetch>[1];'
      );
    }
    lines.push(
      `    const localize = (href${ts(': string')}) => localizeHref(href, locale);`,
      '    return {',
      '      // back/forward/refresh need no prefix and pass through untouched.',
      '      ...router,',
      `      push: (href${ts(': string')}, options${ts('?: NavigateOptions')}) =>`,
      '        router.push(localize(href), options),',
      `      replace: (href${ts(': string')}, options${ts('?: NavigateOptions')}) =>`,
      '        router.replace(localize(href), options),',
      `      prefetch: (href${ts(': string')}, options${ts('?: PrefetchOptions')}) =>`,
      '        router.prefetch(localize(href), options),',
      '    };',
      '  }, [router, locale]);',
      '}',
      ''
    );
  }

  return lines.join('\n');
}

type RedirectCallSite = { file: string; line: number; callee: string };

/**
 * Call sites of `redirect`/`permanentRedirect` imported from THIS wrapper
 * module, with line numbers, so the report can name the server redirects that
 * lose their locale prefix instead of filing one unactionable note against the
 * wrapper. Only string-form calls can reach here: the object form
 * (`redirect({ href, locale })`) is one of next-intl's locale-aware
 * signatures, and any file using one holds the whole wrapper before this runs.
 * Best-effort by design; an unreadable or unparsable file is skipped (the
 * regular source pass owns those diagnoses).
 */
function findWrapperRedirectCallSites(
  wrapper: string,
  ctx: MigrationContext
): RedirectCallSite[] {
  const files = ctx.projectFiles ?? ctx.sourceFiles ?? [];
  const sites: RedirectCallSite[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (file === wrapper) continue;
    let code: string;
    try {
      code = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Cheap pre-filter; correctness comes from the import check below.
    // Case-insensitive: 'permanentRedirect' has no lowercase 'redirect' in it.
    if (!/redirect/i.test(code)) continue;
    let ast: t.File;
    try {
      ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
      });
    } catch {
      continue;
    }
    const locals = new Map<string, string>();
    const namespaceLocals = new Set<string>();
    for (const statement of ast.program.body) {
      if (!t.isImportDeclaration(statement)) continue;
      if (statement.importKind === 'type') continue;
      if (!importTargetsFile(statement.source.value, file, wrapper)) continue;
      for (const specifier of statement.specifiers) {
        if (t.isImportNamespaceSpecifier(specifier)) {
          namespaceLocals.add(specifier.local.name);
          continue;
        }
        if (
          t.isImportSpecifier(specifier) &&
          specifier.importKind !== 'type' &&
          t.isIdentifier(specifier.imported) &&
          isRedirectName(specifier.imported.name)
        ) {
          locals.set(specifier.local.name, specifier.imported.name);
        }
      }
    }
    if (locals.size === 0 && namespaceLocals.size === 0) continue;
    walkNodes(ast, (node) => {
      if (!t.isCallExpression(node) || !node.loc) return;
      const callee = node.callee;
      let name: string | undefined;
      if (t.isIdentifier(callee)) {
        name = locals.get(callee.name);
      } else if (
        t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.object) &&
        namespaceLocals.has(callee.object.name) &&
        t.isIdentifier(callee.property) &&
        isRedirectName(callee.property.name)
      ) {
        name = callee.property.name;
      }
      if (!name) return;
      const line = node.loc.start.line;
      const key = `${file}:${line}:${name}`;
      if (seen.has(key)) return;
      seen.add(key);
      sites.push({ file, line, callee: name });
    });
  }
  // The walk is not in source order, so sort for a report that reads top down.
  return sites.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function isRedirectName(name: string): boolean {
  return name === 'redirect' || name === 'permanentRedirect';
}

const MODULE_EXTENSION = /\.[cm]?[jt]sx?$/;

/**
 * True when `specifier`, imported from `importer`, resolves to `target`.
 * Relative and absolute specifiers resolve against the importer's directory;
 * alias ('@/i18n/navigation', '~/x', '#x/y') and baseUrl ('src/i18n/navigation')
 * specifiers are matched by path suffix, the same approximation the driver's
 * client-module scan uses (tsconfig paths are not parsed). Bare package
 * imports match nothing.
 */
function importTargetsFile(
  specifier: string,
  importer: string,
  target: string
): boolean {
  const targetBase = toPosix(target).replace(MODULE_EXTENSION, '');
  const matchesBase = (base: string): boolean =>
    base === targetBase || `${base}/index` === targetBase;
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    const resolved = toPosix(
      path.resolve(path.dirname(importer), specifier)
    ).replace(MODULE_EXTENSION, '');
    return matchesBase(resolved);
  }
  const suffixes: string[] = [];
  const firstSegmentEnd = specifier.indexOf('/');
  if (
    firstSegmentEnd > 0 &&
    ['@', '~', '#'].includes(specifier[0]) &&
    // a scoped package ('@scope/pkg') keeps its scope; only the bare-alias
    // forms '@/x', '~/x', '#x/y' drop the first segment
    (specifier[1] === '/' || specifier[0] !== '@')
  ) {
    suffixes.push(specifier.slice(firstSegmentEnd + 1));
  }
  suffixes.push(specifier);
  return suffixes.some(
    (suffix) =>
      suffix.length > 0 &&
      (targetBase.endsWith(`/${suffix}`) ||
        targetBase.endsWith(`/${suffix}/index`))
  );
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

/**
 * The local name `createNavigation` is bound to when imported from
 * next-intl/navigation, honoring aliases (`import { createNavigation as x }`
 * returns 'x'). Returns null when the file does not actually import it, so a
 * stray comment or unrelated helper is not mistaken for the wrapper.
 */
function findCreateNavigationLocal(ast: t.File): string | null {
  for (const statement of ast.program.body) {
    if (
      !t.isImportDeclaration(statement) ||
      statement.source.value !== 'next-intl/navigation'
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported, { name: 'createNavigation' })
      ) {
        return specifier.local.name;
      }
    }
  }
  return null;
}

/**
 * Detects next-intl's locale-aware programmatic navigation signatures in a
 * caller file: `router.push/replace/prefetch(href, { locale })`, object hrefs
 * (`router.push({ pathname, ... })`), and `redirect({ href, locale })` /
 * `permanentRedirect({ ... })`, where the functions come from anywhere EXCEPT
 * next/navigation or next/router (a createNavigation wrapper, next-intl's
 * legacy client entry, a re-export of either). next/navigation understands
 * none of these shapes, so once the wrapper becomes a passthrough the calls
 * fail TypeScript, redirect targets become /[object Object], and locale
 * selectors silently no-op. Callers importing straight from next/navigation
 * are excluded: an object argument there is broken before the migration ever
 * runs, and holding the file would misattribute a pre-existing bug.
 *
 * Returns a whole-file skip reason, or null when the file is clean. Parse
 * failures return null; the regular source pass owns that diagnosis.
 */
export function detectLocaleAwareNavUsage(code: string): string | null {
  // Cheap pre-filter; correctness comes from the AST walk below.
  if (!/\b(useRouter|redirect|permanentRedirect)\b/.test(code)) return null;

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return null;
  }

  const routerHookLocals = new Set<string>();
  const redirectLocals = new Set<string>();
  const namespaceLocals = new Set<string>();
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    if (statement.importKind === 'type') continue;
    const source = statement.source.value;
    if (source === 'next/navigation' || source === 'next/router') continue;
    for (const specifier of statement.specifiers) {
      if (t.isImportNamespaceSpecifier(specifier)) {
        // `import * as nav from '@/i18n/navigation'` reaches the same
        // wrapper exports through member access (nav.useRouter(),
        // nav.redirect({...})).
        namespaceLocals.add(specifier.local.name);
        continue;
      }
      if (
        !t.isImportSpecifier(specifier) ||
        !t.isIdentifier(specifier.imported) ||
        specifier.importKind === 'type'
      ) {
        continue;
      }
      if (specifier.imported.name === 'useRouter') {
        routerHookLocals.add(specifier.local.name);
      } else if (
        specifier.imported.name === 'redirect' ||
        specifier.imported.name === 'permanentRedirect'
      ) {
        redirectLocals.add(specifier.local.name);
      }
    }
  }
  if (
    routerHookLocals.size === 0 &&
    redirectLocals.size === 0 &&
    namespaceLocals.size === 0
  ) {
    return null;
  }

  // `const router = useRouter()` bindings (wrapper-derived hooks only).
  const routerLocals = new Set<string>();
  const hasLocaleProp = (expr: t.Node | null | undefined): boolean =>
    t.isObjectExpression(expr) &&
    expr.properties.some(
      (property) =>
        t.isObjectProperty(property) &&
        !property.computed &&
        ((t.isIdentifier(property.key) && property.key.name === 'locale') ||
          (t.isStringLiteral(property.key) && property.key.value === 'locale'))
    );

  // `useRouter()` in any of its reachable spellings: a bare imported local,
  // or a namespace member (nav.useRouter()).
  const isUseRouterCall = (node: t.Node | null | undefined): boolean => {
    if (!node || !t.isCallExpression(node)) return false;
    const callee = node.callee;
    if (t.isIdentifier(callee)) return routerHookLocals.has(callee.name);
    return (
      t.isMemberExpression(callee) &&
      !callee.computed &&
      t.isIdentifier(callee.object) &&
      namespaceLocals.has(callee.object.name) &&
      t.isIdentifier(callee.property, { name: 'useRouter' })
    );
  };

  // Pass 1: collect router bindings (the walk is not in source order, so a
  // call site could otherwise be visited before its declarator). Both
  // `const router = useRouter()` and destructured methods
  // (`const { replace } = useRouter()`) count; the latter's locals map to
  // their method names so their BARE calls are checked in pass 2.
  const ROUTER_METHODS = ['push', 'replace', 'prefetch'];
  const routerMethodLocals = new Map<string, string>();
  walkNodes(ast, (node) => {
    if (!t.isVariableDeclarator(node) || !isUseRouterCall(node.init)) return;
    if (t.isIdentifier(node.id)) {
      routerLocals.add(node.id.name);
      return;
    }
    if (t.isObjectPattern(node.id)) {
      for (const property of node.id.properties) {
        if (
          t.isObjectProperty(property) &&
          !property.computed &&
          t.isIdentifier(property.key) &&
          t.isIdentifier(property.value) &&
          ROUTER_METHODS.includes(property.key.name)
        ) {
          routerMethodLocals.set(property.value.name, property.key.name);
        }
      }
    }
  });

  const localeAwareArgsReason = (
    node: t.CallExpression,
    method: string
  ): string | null => {
    if (hasLocaleProp(node.arguments[1])) {
      return `router.${method}(href, { locale }) is next-intl's locale-aware signature, which a plain next/navigation router does not accept; convert this call (and its locale switching) to gt-next manually, then re-run gt migrate`;
    }
    if (t.isObjectExpression(node.arguments[0])) {
      return `router.${method}({ pathname, ... }) object hrefs are next-intl-only; next/navigation takes a string; convert this call manually, then re-run gt migrate`;
    }
    return null;
  };

  // Pass 2: find locale-aware call shapes.
  let reason: string | null = null;
  walkNodes(ast, (node) => {
    if (reason) return;
    if (!t.isCallExpression(node)) return;
    const callee = node.callee;
    if (
      t.isMemberExpression(callee) &&
      !callee.computed &&
      t.isIdentifier(callee.property)
    ) {
      const method = callee.property.name;
      if (ROUTER_METHODS.includes(method)) {
        // `router.replace(...)` on a collected binding, or chained
        // `useRouter().replace(...)` / `nav.useRouter().replace(...)`.
        const onRouterBinding =
          t.isIdentifier(callee.object) && routerLocals.has(callee.object.name);
        if (onRouterBinding || isUseRouterCall(callee.object)) {
          reason = localeAwareArgsReason(node, method);
          return;
        }
      }
      // Namespace redirect: nav.redirect({ href, locale }).
      if (
        t.isIdentifier(callee.object) &&
        namespaceLocals.has(callee.object.name) &&
        (method === 'redirect' || method === 'permanentRedirect') &&
        t.isObjectExpression(node.arguments[0])
      ) {
        reason = `${method}({ href, ... }) is next-intl's object signature; next/navigation's ${method} takes a string path and would navigate to /[object Object]; convert this call manually, then re-run gt migrate`;
      }
      return;
    }
    if (t.isIdentifier(callee)) {
      // Destructured router method called bare: `replace(href, { locale })`.
      const method = routerMethodLocals.get(callee.name);
      if (method) {
        reason = localeAwareArgsReason(node, method);
        if (reason) return;
      }
      if (
        redirectLocals.has(callee.name) &&
        t.isObjectExpression(node.arguments[0])
      ) {
        reason = `${callee.name}({ href, ... }) is next-intl's object signature; next/navigation's ${callee.name} takes a string path and would navigate to /[object Object]; convert this call manually, then re-run gt migrate`;
      }
    }
  });
  return reason;
}

/** Minimal recursive AST walk (babel's traverse needs a scope-attached path;
 *  this detection only needs node shapes, so a plain recursion is cheaper and
 *  keeps this function dependency-free for the driver's per-file scan). */
function walkNodes(root: t.Node, visit: (node: t.Node) => void): void {
  const stack: t.Node[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    visit(node);
    for (const key of Object.keys(node)) {
      const value = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === 'object' && 'type' in item) {
            stack.push(item as t.Node);
          }
        }
      } else if (value && typeof value === 'object' && 'type' in value) {
        stack.push(value as t.Node);
      }
    }
  }
}
