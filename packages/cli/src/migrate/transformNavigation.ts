import { parse } from '@babel/parser';
import * as t from '@babel/types';
import type { SourceResult, TodoEntry } from './types.js';

/** Destructured names we can re-export with equivalent behavior. */
const NEXT_NAVIGATION_EXPORTS = new Set([
  'redirect',
  'permanentRedirect',
  'usePathname',
  'useRouter',
]);

/**
 * Rewrites the thin `createNavigation(routing)` wrapper module so every
 * existing `import { Link } from '@/i18n/navigation'` in the app keeps
 * compiling: Link becomes gt-next's locale-aware Link, the rest re-export
 * from next/navigation. Anything beyond that shape is left for manual work.
 */
export function transformNavigationFile(
  file: string,
  code: string
): SourceResult {
  const none: SourceResult = {
    code: null,
    todos: [],
    skipReasons: [],
    usedRich: false,
  };
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
        t.isIdentifier(init.callee, { name: 'createNavigation' }) &&
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

  if (!sawCreateNavigation) return none;
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

  const lines: string[] = [];
  const passthrough = destructured.filter((name) =>
    NEXT_NAVIGATION_EXPORTS.has(name)
  );
  if (destructured.includes('Link')) {
    lines.push("export { default as Link } from 'gt-next/link';");
  }
  if (passthrough.length > 0) {
    lines.push(`export { ${passthrough.join(', ')} } from 'next/navigation';`);
  }

  const todos: TodoEntry[] = [
    {
      file,
      reason:
        'redirect()/useRouter() calls are no longer locale-prefixed automatically — gt-next localizes <Link> hrefs; prefix programmatic navigation manually where a locale path is required',
    },
  ];
  lines.push(
    '// TODO(gt-migrate): redirect()/useRouter() are plain next/navigation now —'
  );
  lines.push(
    '// gt-next localizes <Link> hrefs, but programmatic navigation is not auto-prefixed.'
  );

  return {
    code: lines.join('\n') + '\n',
    todos,
    skipReasons: [],
    usedRich: false,
  };
}
