import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { classifyMessage } from '../catalogs/classifyMessage.js';
import { discoverCatalogs } from '../catalogs/discover.js';
import { parseRoutingConfig } from '../config/parseRoutingConfig.js';
import { transformMiddlewareFile } from '../transforms/transformMiddleware.js';
import { transformNavigationFile } from '../transforms/transformNavigation.js';
import { transformNextConfigFile } from '../transforms/transformNextConfig.js';
import { transformRequestConfigFile } from '../transforms/transformRequestConfig.js';
import type { RoutingInfo } from '../pipeline/types.js';
import type { SourceAdapter } from './types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

const PROVIDER = 'NextIntlClientProvider';

/** true when an import source is next-intl or one of its subpaths. */
function ownsModule(source: string): boolean {
  return source === 'next-intl' || source.startsWith('next-intl/');
}

/**
 * True when `code` renders a NextIntlClientProvider JSX element imported from
 * next-intl (alias-aware). The driver uses this to DEFER provider-bearing
 * non-layout files: like layouts, their provider-retention decision depends on
 * the final skip set, not known during the pass that would otherwise transform
 * them. Cheap-exits before parsing when the provider name is absent.
 */
function hasProvider(code: string): boolean {
  if (!code.includes(PROVIDER)) return false;
  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      tokens: true,
      createParenthesizedExpressions: true,
    });
  } catch {
    return false;
  }

  const providerLocals = new Set<string>();
  traverse(ast, {
    ImportDeclaration(path) {
      if (!ownsModule(path.node.source.value)) return;
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) continue;
        const imported = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : specifier.imported.value;
        if (imported === PROVIDER) providerLocals.add(specifier.local.name);
      }
    },
  });
  if (providerLocals.size === 0) return false;

  let found = false;
  traverse(ast, {
    JSXOpeningElement(path) {
      const name = path.node.name;
      if (t.isJSXIdentifier(name) && providerLocals.has(name.name)) {
        found = true;
        path.stop();
      }
    },
  });
  return found;
}

/**
 * Adapter #1: next-intl -> gt-next. Holds every next-intl-specific table,
 * string, and regex, and wires the config-lane transforms (whose bodies stay in
 * their own files). The gt-next output strings remain in the core transforms.
 */
export const nextIntlAdapter: SourceAdapter = {
  id: 'next-intl',
  displayName: 'next-intl',

  ownsModule,
  mentionedIn: (code) => /['"]next-intl(?:\/[^'"]*)?['"]/.test(code),

  clientSwaps: new Set(['useTranslations', 'useLocale']),
  serverSwaps: new Set(['getTranslations', 'getLocale']),
  removals: new Set(['setRequestLocale', 'unstable_setRequestLocale']),
  messagesHooks: new Set(['useMessages', 'getMessages']),
  localeValidators: new Set(['hasLocale']),
  translationHooks: { client: 'useTranslations', server: 'getTranslations' },
  providerName: PROVIDER,
  localeType: 'Locale',

  hasProvider,
  classifyMessage,

  parseRoutingConfig,
  discoverCatalogs,

  navigation: {
    isNavigationFile: (code) => code.includes('createNavigation'),
    transformNavigation: transformNavigationFile,
  },
  transformNextConfig: transformNextConfigFile,
  transformMiddleware: transformMiddlewareFile,
  transformRequestConfig: transformRequestConfigFile,

  nextConfigCandidates: ['next.config.ts', 'next.config.js', 'next.config.mjs'],
  middlewareCandidates: [
    'middleware.ts',
    'middleware.js',
    'src/middleware.ts',
    'src/middleware.js',
    'proxy.ts',
    'src/proxy.ts',
  ],

  projectUsagePattern:
    /(?:from\s+|import\s*\(\s*|import\s*|require\s*\(\s*)['"]next-intl(?:\/|['"])/,
  teardownPackages: ['next-intl'],
  teardownConfigFiles: (routing: RoutingInfo) =>
    [routing.routingFile, routing.requestFile].filter(
      (file): file is string => file !== null
    ),
};
