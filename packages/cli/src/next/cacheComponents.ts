import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

export const CACHE_COMPONENTS_DOCS_URL =
  'https://generaltranslation.com/docs/react/nextjs/cache-components';

/**
 * How setup handles a Next.js config with cacheComponents enabled:
 * - migrate: a fresh-template app whose root layout and page can be moved
 *   under app/[locale] with locale-safe request functions and a proxy.
 * - manual: anything else; the root layout is left alone so the build keeps
 *   working, and a person or agent follows the Cache Components guide.
 */
export type CacheComponentsSetup =
  | { mode: 'migrate'; appDir: string; layout: string; page: string }
  | { mode: 'manual'; reason: string; appDir: string; proxy?: string };

const SCRIPT_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const ROOT_FILES = ['layout', 'page'] as const;

function parseModule(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

/** Whether the Next.js config sets cacheComponents: true. */
export function isCacheComponentsEnabled(nextConfigPath: string): boolean {
  let enabled = false;
  try {
    traverse(parseModule(fs.readFileSync(nextConfigPath, 'utf8')), {
      ObjectProperty(nodePath) {
        const { key, value } = nodePath.node;
        if (
          (t.isIdentifier(key, { name: 'cacheComponents' }) ||
            t.isStringLiteral(key, { value: 'cacheComponents' })) &&
          t.isBooleanLiteral(value, { value: true })
        ) {
          enabled = true;
          nodePath.stop();
        }
      },
    });
  } catch {
    // An unparsable config is reported by handleInitGT.
  }
  return enabled;
}

/**
 * Decides whether the app can be migrated to the Cache Components layout,
 * or returns undefined when a custom getLocale() already exists.
 * Only an app directory holding nothing but the root layout, the root page,
 * and non-code assets is moved, because moving routes changes URLs and
 * relative imports that setup cannot safely rewrite in a larger app.
 */
export function resolveCacheComponentsSetup(
  cwd: string
): CacheComponentsSetup | undefined {
  const findFile = (name: string) =>
    ['', 'src']
      .flatMap((dir) =>
        fs.existsSync(path.join(cwd, dir))
          ? fs
              .readdirSync(path.join(cwd, dir))
              .filter(
                (file) =>
                  SCRIPT_EXTENSION.test(file) &&
                  file.replace(SCRIPT_EXTENSION, '') === name
              )
              .map((file) => path.join(dir, file))
          : []
      )
      .at(0);
  // A custom getLocale() means the app already has its own setup.
  if (findFile('getLocale')) return undefined;

  const sourceDir = fs.existsSync(path.join(cwd, 'src/app')) ? 'src' : '';
  const appDir = path.join(sourceDir, 'app');
  const proxy = findFile('proxy') ?? findFile('middleware');
  const manual = (reason: string): CacheComponentsSetup => ({
    mode: 'manual',
    reason,
    appDir,
    proxy,
  });
  if (!fs.existsSync(path.join(cwd, appDir))) {
    return manual('no app directory was found');
  }
  if (proxy) return manual(`${proxy} already exists`);
  const region = findFile('getRegion');
  if (region) return manual(`${region} already exists`);

  const found: Partial<Record<(typeof ROOT_FILES)[number], string>> = {};
  for (const entry of fs.readdirSync(path.join(cwd, appDir), {
    withFileTypes: true,
  })) {
    if (entry.isDirectory()) {
      return manual(`${appDir} has route segments or folders`);
    }
    if (!SCRIPT_EXTENSION.test(entry.name)) continue;
    const name = entry.name.replace(SCRIPT_EXTENSION, '');
    if (name !== 'layout' && name !== 'page') {
      return manual(`${appDir} has other route files such as ${entry.name}`);
    }
    found[name] = path.join(appDir, entry.name);
  }
  if (!found.layout || !found.page) {
    return manual(`${appDir} has no root layout and page`);
  }
  return { mode: 'migrate', appDir, layout: found.layout, page: found.page };
}

/** The steps a person or agent follows when setup cannot migrate the app. */
export function getCacheComponentsManualFix({
  appDir,
  proxy,
}: Extract<CacheComponentsSetup, { mode: 'manual' }>): string {
  const sourceDir = path.dirname(appDir);
  const requestFunctions = sourceDir === '.' ? '' : `${sourceDir}/`;
  return [
    `Move the root layout and routes under ${appDir}/[locale] and export generateStaticParams() from the layout with getLocales()`,
    `add ${requestFunctions}getLocale.ts reading locale() from next/root-params, and ${requestFunctions}getRegion.ts`,
    proxy
      ? `use createNextMiddleware() from gt-next/middleware in ${proxy}`
      : `add ${requestFunctions}proxy.ts with createNextMiddleware() from gt-next/middleware`,
    `then wrap the layout's <body> children in <GTProvider>; see ${CACHE_COMPONENTS_DOCS_URL}`,
  ].join(', ');
}

/**
 * Prefixes relative imports with ../ after a move one directory deeper, and
 * points typed LayoutProps<'/'> / PageProps<'/'> at the new route.
 */
export function rewriteMovedRootFile(code: string): string {
  const edits: { start: number; end: number; text: string }[] = [];
  const replaceString = (node: t.StringLiteral, value: string) =>
    edits.push({
      start: node.start! + 1,
      end: node.end! - 1,
      text: value,
    });
  const moveSpecifier = (node: t.Node | null | undefined) => {
    if (t.isStringLiteral(node) && node.value.startsWith('.')) {
      replaceString(node, path.posix.join('..', node.value));
    }
  };

  traverse(parseModule(code), {
    ImportDeclaration: ({ node }) => moveSpecifier(node.source),
    ExportNamedDeclaration: ({ node }) => moveSpecifier(node.source),
    ExportAllDeclaration: ({ node }) => moveSpecifier(node.source),
    CallExpression: ({ node }) => {
      if (
        t.isImport(node.callee) ||
        t.isIdentifier(node.callee, { name: 'require' })
      ) {
        moveSpecifier(node.arguments[0]);
      }
    },
    TSTypeReference: ({ node }) => {
      const param = node.typeParameters?.params[0];
      if (
        t.isIdentifier(node.typeName) &&
        ['LayoutProps', 'PageProps'].includes(node.typeName.name) &&
        t.isTSLiteralType(param) &&
        t.isStringLiteral(param.literal, { value: '/' })
      ) {
        replaceString(param.literal, '/[locale]');
      }
    },
  });

  return edits
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, { start, end, text }) =>
        result.slice(0, start) + text + result.slice(end),
      code
    );
}

/** Imports getLocales after the last import and appends generateStaticParams(). */
function addStaticParams(code: string): string {
  const lastImport = parseModule(code)
    .program.body.filter((node) => t.isImportDeclaration(node))
    .at(-1);
  const at = lastImport?.end ?? 0;
  const separator = lastImport ? '\n' : '';
  return `${code.slice(0, at)}${separator}import { getLocales } from 'gt-next';\n${code.slice(at).replace(/^\n/, '')}${STATIC_PARAMS}`;
}

const STATIC_PARAMS = `
export function generateStaticParams() {
  return getLocales().map((locale) => ({ locale }));
}
`;

const GET_LOCALE = `import { locale } from 'next/root-params';

export default async function getLocale() {
  return await locale();
}
`;

const GET_REGION = `export default async function getRegion() {
  return undefined;
}
`;

const PROXY = `import { createNextMiddleware } from 'gt-next/middleware';

export default createNextMiddleware();

export const config = {
  matcher: ['/((?!api|static|.*\\\\..*|_next).*)'],
};
`;

/**
 * Moves the root layout and page under app/[locale] and adds the request
 * functions and proxy that Cache Components needs. Returns the written files.
 */
export async function migrateToCacheComponents(
  cwd: string,
  setup: Extract<CacheComponentsSetup, { mode: 'migrate' }>,
  typescript: boolean
): Promise<string[]> {
  const localeDir = path.join(setup.appDir, '[locale]');
  await fs.promises.mkdir(path.join(cwd, localeDir), { recursive: true });

  // New files first: an existing one fails before any user file moves.
  const written: string[] = [];
  const sourceDir = path.dirname(setup.appDir);
  const extension = typescript ? '.ts' : '.js';
  for (const [name, content] of [
    ['getLocale', GET_LOCALE],
    ['getRegion', GET_REGION],
    ['proxy', PROXY],
  ]) {
    const file = path.join(sourceDir, name + extension);
    await fs.promises.writeFile(path.join(cwd, file), content, { flag: 'wx' });
    written.push(path.join(cwd, file));
  }
  for (const file of [setup.layout, setup.page]) {
    const target = path.join(localeDir, path.basename(file));
    let code = rewriteMovedRootFile(
      await fs.promises.readFile(path.join(cwd, file), 'utf8')
    );
    if (file === setup.layout) code = addStaticParams(code);
    await fs.promises.writeFile(path.join(cwd, target), code);
    await fs.promises.rm(path.join(cwd, file));
    written.push(path.join(cwd, target));
  }

  return written;
}
