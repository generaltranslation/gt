import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import fg from 'fast-glob';
import { loadConfig as loadTsconfigPaths } from 'tsconfig-paths';

// Handle CommonJS/ESM interop
const traverse = traverseModule.default || traverseModule;

export const CACHE_COMPONENTS_DOCS_URL =
  'https://generaltranslation.com/docs/react/nextjs/cache-components';

/** A rewritten file, at its path after the move (relative to the app root). */
type Edit = { file: string; code: string };

/**
 * How setup handles a Next.js config with cacheComponents enabled:
 * - migrate: the app's routes move under app/[locale], with every import
 *   that crosses the move rewritten, plus locale-safe request functions and
 *   a proxy. Everything is computed before any file changes.
 * - manual: setup cannot migrate safely; the root layout is left alone so
 *   the build keeps working, and a person or agent follows the guide.
 */
export type CacheComponentsSetup =
  | {
      mode: 'migrate';
      appDir: string;
      moves: { from: string; to: string }[];
      edits: Edit[];
    }
  | { mode: 'manual'; reason: string; appDir: string; proxy?: string };

const SCRIPT_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
/** Special files that belong to the root segment and move with it. */
const SEGMENT_FILES = new Set([
  'layout',
  'page',
  'loading',
  'error',
  'not-found',
  'template',
  'default',
  'route',
]);
/** Files that make a folder part of the route tree. */
const ROUTE_FILES = new Set(['layout', 'page', 'route', 'default']);
const IGNORED = ['**/node_modules/**', '**/.next/**', '**/.git/**', 'out/**'];

function parseModule(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

const scriptName = (file: string) =>
  SCRIPT_EXTENSION.test(file) ? file.replace(SCRIPT_EXTENSION, '') : undefined;
/** Route files can also be MDX pages (pageExtensions). */
const routeName = (file: string) =>
  scriptName(file) ?? file.match(/^(.*)\.mdx?$/)?.[1];
const toPosix = (file: string) => file.split(path.sep).join('/');

/** Whether the Next.js config sets the flag to true. */
function hasNextConfigFlag(nextConfigPath: string, flag: string): boolean {
  let enabled = false;
  try {
    traverse(parseModule(fs.readFileSync(nextConfigPath, 'utf8')), {
      ObjectProperty(nodePath) {
        const { key, value } = nodePath.node;
        if (
          (t.isIdentifier(key, { name: flag }) ||
            t.isStringLiteral(key, { value: flag })) &&
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

/** Whether the Next.js config sets cacheComponents: true. */
export function isCacheComponentsEnabled(nextConfigPath: string): boolean {
  return hasNextConfigFlag(nextConfigPath, 'cacheComponents');
}

/** Wildcard path aliases from tsconfig.json or jsconfig.json. */
function loadAliases(cwd: string) {
  let baseUrl: string | undefined;
  let paths: Record<string, string[]> | undefined;
  const tsconfig = loadTsconfigPaths(cwd);
  if (tsconfig.resultType === 'success') {
    baseUrl = tsconfig.absoluteBaseUrl;
    paths = tsconfig.paths;
  } else {
    try {
      const { compilerOptions } = JSON.parse(
        fs.readFileSync(path.join(cwd, 'jsconfig.json'), 'utf8')
      );
      baseUrl = path.resolve(cwd, compilerOptions?.baseUrl ?? '.');
      paths = compilerOptions?.paths;
    } catch {
      // No aliases.
    }
  }
  return Object.entries(paths ?? {}).flatMap(([pattern, [target]]) =>
    baseUrl && pattern.endsWith('*') && target?.endsWith('*')
      ? [
          {
            prefix: pattern.slice(0, -1),
            dir: path.resolve(baseUrl, target.slice(0, -1)),
          },
        ]
      : []
  );
}

function hasRouteFile(dir: string): boolean {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some((entry) =>
      entry.isDirectory()
        ? entry.name !== 'node_modules' &&
          hasRouteFile(path.join(dir, entry.name))
        : ROUTE_FILES.has(routeName(entry.name) ?? '')
    );
}

/**
 * Plans the move of the app's routes under app/[locale], or returns undefined
 * when a custom getLocale() already exists. Root-only files (api routes,
 * metadata files, global-error, styles) and folders without routes stay
 * where they are.
 */
export function resolveCacheComponentsSetup(
  cwd: string,
  nextConfigPath: string
): CacheComponentsSetup | undefined {
  const findFile = (name: string) =>
    ['', 'src']
      .flatMap((dir) =>
        fs.existsSync(path.join(cwd, dir))
          ? fs
              .readdirSync(path.join(cwd, dir))
              .filter((file) => scriptName(file) === name)
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
  const absoluteAppDir = path.join(cwd, appDir);
  if (!fs.existsSync(absoluteAppDir)) {
    return manual('no app directory was found');
  }
  if (proxy) return manual(`${proxy} already exists`);
  const region = findFile('getRegion');
  if (region) return manual(`${region} already exists`);
  if (hasNextConfigFlag(nextConfigPath, 'typedRoutes')) {
    return manual('typedRoutes would reject links to the moved routes');
  }

  const entries = fs.readdirSync(absoluteAppDir, { withFileTypes: true });
  const layout = entries.find(
    (entry) => entry.isFile() && scriptName(entry.name) === 'layout'
  );
  if (!layout) {
    return manual(`${appDir} has no single root layout`);
  }
  const dynamic = entries.find(
    (entry) => entry.isDirectory() && entry.name.startsWith('[')
  );
  if (dynamic) {
    return manual(`${appDir}/${dynamic.name} is already a dynamic segment`);
  }

  const moves = entries
    .filter((entry) =>
      entry.isDirectory()
        ? entry.name !== 'api' &&
          !entry.name.startsWith('_') &&
          hasRouteFile(path.join(absoluteAppDir, entry.name))
        : SEGMENT_FILES.has(routeName(entry.name) ?? '')
    )
    .map((entry) => ({
      from: path.join(appDir, entry.name),
      to: path.join(appDir, '[locale]', entry.name),
    }));

  /** Where an absolute path (with or without its extension) ends up. */
  const relocate = (target: string) => {
    for (const { from, to } of moves) {
      const source = path.join(cwd, from);
      const destination = path.join(cwd, to);
      if (target === source || target.startsWith(source + path.sep)) {
        return destination + target.slice(source.length);
      }
      const extension = path.extname(source);
      if (extension && target === source.slice(0, -extension.length)) {
        return destination.slice(0, -extension.length);
      }
    }
    return target;
  };

  // MDX is not parsed, so its relative imports cannot be rewritten.
  const mdxWithImports = fg
    .sync(`${toPosix(appDir)}/**/*.{md,mdx}`, { cwd, ignore: IGNORED })
    .find(
      (file) =>
        relocate(path.join(cwd, file)) !== path.join(cwd, file) &&
        /^\s*(?:import|export)\b[^\n]*\bfrom\s+['"]\./m.test(
          fs.readFileSync(path.join(cwd, file), 'utf8')
        )
    );
  if (mdxWithImports) {
    return manual(`${mdxWithImports} has relative imports`);
  }

  const aliases = loadAliases(cwd);
  const edits: Edit[] = [];
  const files = fg.sync('**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}', {
    cwd,
    absolute: true,
    ignore: IGNORED,
  });
  for (const file of files) {
    const moved = relocate(file);
    const code = fs.readFileSync(file, 'utf8');
    let rewritten: string;
    try {
      rewritten = rewriteFile(code, {
        resolve: (specifier) => {
          if (specifier.startsWith('.')) {
            const original = path.resolve(path.dirname(file), specifier);
            const target = relocate(original);
            if (target === original && moved === file) return specifier;
            const relative = toPosix(
              path.relative(path.dirname(moved), target)
            );
            return relative.startsWith('.') ? relative : `./${relative}`;
          }
          const alias = aliases.find(({ prefix }) =>
            specifier.startsWith(prefix)
          );
          if (!alias) return specifier;
          const target = relocate(
            path.join(alias.dir, specifier.slice(alias.prefix.length))
          );
          const relative = path.relative(alias.dir, target);
          return relative.startsWith('..')
            ? specifier
            : alias.prefix + toPosix(relative);
        },
        typedRoutes: moved !== file,
      });
    } catch (error) {
      if (moved === file) continue;
      return manual(
        `${path.relative(cwd, file)} could not be parsed (${String(error)})`
      );
    }
    if (file === path.join(absoluteAppDir, layout.name)) {
      if (/\bgenerateStaticParams\b/.test(code)) {
        return manual('the root layout already exports generateStaticParams');
      }
      rewritten = addStaticParams(rewritten);
    }
    if (rewritten !== code) {
      edits.push({ file: path.relative(cwd, moved), code: rewritten });
    }
  }
  return { mode: 'migrate', appDir, moves, edits };
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
 * Rewrites module specifiers with resolve(), and, for moved files, points
 * typed LayoutProps/PageProps routes at the [locale] segment.
 */
export function rewriteFile(
  code: string,
  {
    resolve,
    typedRoutes,
  }: { resolve: (specifier: string) => string; typedRoutes: boolean }
): string {
  const edits: { start: number; end: number; text: string }[] = [];
  const replaceString = (node: t.StringLiteral, value: string) => {
    if (value !== node.value) {
      edits.push({ start: node.start! + 1, end: node.end! - 1, text: value });
    }
  };
  const visitSpecifier = (node: t.Node | null | undefined) => {
    if (t.isStringLiteral(node)) replaceString(node, resolve(node.value));
  };

  traverse(parseModule(code), {
    ImportDeclaration: ({ node }) => visitSpecifier(node.source),
    ExportNamedDeclaration: ({ node }) => visitSpecifier(node.source),
    ExportAllDeclaration: ({ node }) => visitSpecifier(node.source),
    CallExpression: ({ node }) => {
      if (
        t.isImport(node.callee) ||
        t.isIdentifier(node.callee, { name: 'require' })
      ) {
        visitSpecifier(node.arguments[0]);
      }
    },
    TSTypeReference: ({ node }) => {
      const param = node.typeParameters?.params[0];
      if (
        typedRoutes &&
        t.isIdentifier(node.typeName) &&
        ['LayoutProps', 'PageProps'].includes(node.typeName.name) &&
        t.isTSLiteralType(param) &&
        t.isStringLiteral(param.literal) &&
        param.literal.value.startsWith('/')
      ) {
        const route = param.literal.value;
        replaceString(param.literal, `/[locale]${route === '/' ? '' : route}`);
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
 * Moves the app's routes under app/[locale], applies the planned import
 * rewrites, and adds the request functions and proxy that Cache Components
 * needs. Returns the files it wrote.
 */
export async function migrateToCacheComponents(
  cwd: string,
  setup: Extract<CacheComponentsSetup, { mode: 'migrate' }>,
  typescript: boolean
): Promise<string[]> {
  await fs.promises.mkdir(path.join(cwd, setup.appDir, '[locale]'), {
    recursive: true,
  });

  // New files first: an existing one fails before any user file moves.
  const written: string[] = [];
  const sourceDir = path.dirname(setup.appDir);
  const extension = typescript ? '.ts' : '.js';
  for (const [name, content] of [
    ['getLocale', GET_LOCALE],
    ['getRegion', GET_REGION],
    ['proxy', PROXY],
  ]) {
    const file = path.join(cwd, sourceDir, name + extension);
    await fs.promises.writeFile(file, content, { flag: 'wx' });
    written.push(file);
  }
  for (const { from, to } of setup.moves) {
    await fs.promises.rename(path.join(cwd, from), path.join(cwd, to));
  }
  for (const { file, code } of setup.edits) {
    await fs.promises.writeFile(path.join(cwd, file), code);
    written.push(path.join(cwd, file));
  }
  return written;
}
