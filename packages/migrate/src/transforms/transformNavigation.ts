import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { packageNameOf } from './importUtils.js';
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

/**
 * Rewrites the thin `createNavigation(routing)` wrapper module so every
 * existing `import { Link } from '@/i18n/navigation'` in the app keeps
 * compiling: Link becomes gt-next's locale-aware Link, usePathname becomes a
 * locale-stripping wrapper (next-intl's returns the pathname WITHOUT the
 * prefix), the rest re-export from next/navigation. Anything beyond that
 * shape; including localized `pathnames` routing; is left for manual work.
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
    (name) => NEXT_NAVIGATION_EXPORTS.has(name) && name !== 'usePathname'
  );

  if (wrapsPathname) {
    lines.push(
      "import { usePathname as useNextPathname } from 'next/navigation';"
    );
    lines.push("import { useLocale } from 'gt-next';");
    lines.push('');
  }
  if (destructured.includes('Link')) {
    lines.push("export { default as Link } from 'gt-next/link';");
  }
  if (passthrough.length > 0) {
    lines.push(`export { ${passthrough.join(', ')} } from 'next/navigation';`);
  }
  if (wrapsPathname) {
    lines.push('');
    lines.push(
      "// next-intl's usePathname returns the pathname without the locale"
    );
    lines.push("// prefix; next/navigation's includes it. Strip it to stay");
    lines.push('// drop-in for existing callers.');
    lines.push('export function usePathname() {');
    lines.push('  const pathname = useNextPathname();');
    lines.push('  const locale = useLocale();');
    lines.push('  const prefix = `/${locale}`;');
    lines.push("  if (pathname === prefix) return '/';");
    lines.push('  return pathname.startsWith(`${prefix}/`)');
    lines.push('    ? pathname.slice(prefix.length)');
    lines.push('    : pathname;');
    lines.push('}');
  }

  const todos: TodoEntry[] = [];
  if (passthrough.length > 0) {
    todos.push({
      file,
      reason: `${passthrough.join('/')} calls are no longer locale-prefixed automatically; gt-next localizes <Link> hrefs; prefix programmatic navigation manually where a locale path is required`,
    });
    lines.push('');
    lines.push(
      `// TODO(gt-migrate): ${passthrough.join('/')} are plain next/navigation now.`
    );
    lines.push(
      '// gt-next localizes <Link> hrefs, but programmatic navigation is not auto-prefixed.'
    );
  }

  return {
    code: lines.join('\n') + '\n',
    todos,
    skipReasons: [],
  };
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
