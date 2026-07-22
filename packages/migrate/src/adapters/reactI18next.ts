import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import { classifyMessage } from '../catalogs/classifyMessage.js';
import { getI18nextConfig } from '../config/reactI18nextConfig.js';
import {
  discoverReactI18nextCatalogs,
  emitReactI18nextCatalogs,
} from '../catalogs/reactI18nextCatalogs.js';
import { transformReactI18nextLayout } from '../transforms/transformReactI18nextLayout.js';
import { transformReactI18nextNextConfig } from '../transforms/transformReactI18nextNextConfig.js';
import { transformReactI18nextSource } from '../transforms/transformReactI18nextSource.js';
import type { RoutingInfo } from '../pipeline/types.js';
import type { SourceAdapter } from './types.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

const PROVIDER = 'I18nextProvider';

/** react-i18next and its subpaths (TransWithoutContext lives under a subpath). */
function ownsModule(source: string): boolean {
  return source === 'react-i18next' || source.startsWith('react-i18next/');
}

/**
 * True when `code` renders an `<I18nextProvider>` imported from react-i18next
 * (alias-aware). The driver defers these files so their provider-retention
 * decision can wait for the final skip set, exactly as it does for next-intl.
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

/** Builds RoutingInfo from the i18next init config. react-i18next has no
 *  next-intl-style locale-prefix URL model, so those fields are null and the
 *  middleware/navigation branches stay inert. */
function parseRoutingConfig(cwd: string): RoutingInfo {
  const config = getI18nextConfig(cwd);
  return {
    locales: config.locales,
    defaultLocale: config.defaultLocale,
    localePrefix: null,
    pathnames: null,
    routingFile: null,
    requestFile: null,
  };
}

/**
 * Adapter #2: react-i18next -> gt-next. v1 scope is the CLIENT surface, the
 * CATALOGS (i18next JSON -> merged ICU dictionaries), and the PROVIDER. The
 * server side of a raw react-i18next App Router app is a bespoke getT() built on
 * initI18next/resourcesToBackend with nothing importable to swap, so every
 * server call site is skipped and reported with a getTranslations recipe rather
 * than miscompiled. The supported-source rules live in the migrate command's
 * module doc comment (cli/commands/migrate.ts) and resolveSource.ts.
 */
export const reactI18nextAdapter: SourceAdapter = {
  id: 'react-i18next',
  displayName: 'react-i18next',

  ownsModule,
  mentionedIn: (code) => /['"](?:react-)?i18next(?:\/[^'"]*)?['"]/.test(code),

  // Symbol tables drive the CORE next-intl transform; react-i18next supplies its
  // own transformSource/transformLayout, so these are inert. They are populated
  // descriptively (not consumed) to satisfy the interface.
  clientSwaps: new Set(['useTranslation']),
  serverSwaps: new Set(),
  removals: new Set(),
  messagesHooks: new Set(),
  localeValidators: new Set(),
  translationHooks: { client: 'useTranslation', server: 'getT' },
  providerName: PROVIDER,
  localeType: null,

  hasProvider,
  classifyMessage,

  parseRoutingConfig,
  discoverCatalogs: discoverReactI18nextCatalogs,

  transformSource: (file, code, ctx, options) =>
    transformReactI18nextSource(file, code, ctx, {
      retainProvider: options.retainProvider,
    }),
  transformLayout: transformReactI18nextLayout,
  transformNextConfig: transformReactI18nextNextConfig,
  emitCatalogs: emitReactI18nextCatalogs,

  // react-i18next has no navigation wrapper, no standard middleware, and no
  // next-intl-style request config; those lanes are simply absent.
  nextConfigCandidates: ['next.config.ts', 'next.config.js', 'next.config.mjs'],
  middlewareCandidates: [],

  // Mirrors ownsModule: this adapter migrates the react-i18next client surface,
  // so the out-of-scope teardown scan counts only react-i18next imports. Bare
  // i18next (the hand-rolled server runtime) is out of v1 scope and must not
  // count as an unscanned usage, or a scoped run wrongly retains the provider.
  projectUsagePattern:
    /(?:from\s+|import\s*\(\s*|import\s*|require\s*\(\s*)['"]react-i18next(?:\/|['"])/,
  // The i18next runtime bootstrap and the bespoke server getT() are hand-rolled;
  // removing the deps is a manual step once the server is migrated, so no
  // automatic package/file teardown.
  teardownPackages: [],
  teardownConfigFiles: () => [],
};
