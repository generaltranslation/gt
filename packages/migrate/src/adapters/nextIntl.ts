import { classifyMessage } from '../catalogs/classifyMessage.js';
import { makeProviderDetector } from './providerDetector.js';
import { discoverCatalogs } from '../catalogs/discover.js';
import {
  NEXT_CONFIG_CANDIDATES,
  parseRoutingConfig,
} from '../config/parseRoutingConfig.js';
import { transformMiddlewareFile } from '../transforms/transformMiddleware.js';
import {
  detectLocaleAwareNavUsage,
  transformNavigationFile,
} from '../transforms/transformNavigation.js';
import { MODULE_SPECIFIER_PREFIX_SOURCE } from '../fs/moduleSpecifiers.js';
import { transformNextConfigFile } from '../transforms/transformNextConfig.js';
import { transformRequestConfigFile } from '../transforms/transformRequestConfig.js';
import type { RoutingInfo } from '../pipeline/types.js';
import type { SourceAdapter } from './types.js';

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
const hasProvider = makeProviderDetector(PROVIDER, ownsModule);

/**
 * Adapter #1: next-intl -> gt-next. Holds every next-intl-specific table,
 * string, and regex, and wires the config-lane transforms (whose bodies stay in
 * their own files). The gt-next output strings remain in the core transforms.
 */
export const nextIntlAdapter: SourceAdapter = {
  id: 'next-intl',
  displayName: 'next-intl',
  missingKeyBehavior:
    'next-intl rendered the raw key and logged a MISSING_MESSAGE error, so existing misses were visible',

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
    detectLocaleAwareCaller: detectLocaleAwareNavUsage,
  },
  transformNextConfig: transformNextConfigFile,
  transformMiddleware: transformMiddlewareFile,
  transformRequestConfig: transformRequestConfigFile,

  // Same list parseRoutingConfig reads the plugin's request-config argument
  // from, so the two lanes can never disagree about which file is the config.
  nextConfigCandidates: NEXT_CONFIG_CANDIDATES,
  // Both extensions of both filenames: Next 16 runs proxy.js exactly as it
  // runs proxy.ts (round-10 finding 9).
  middlewareCandidates: [
    'middleware.ts',
    'middleware.js',
    'src/middleware.ts',
    'src/middleware.js',
    'proxy.ts',
    'proxy.js',
    'src/proxy.ts',
    'src/proxy.js',
  ],
  middlewareModule: 'next-intl/middleware',

  retainedNavigationPattern: new RegExp(
    MODULE_SPECIFIER_PREFIX_SOURCE + String.raw`['"]next-intl\/navigation['"]`
  ),
  projectUsagePattern: new RegExp(
    MODULE_SPECIFIER_PREFIX_SOURCE + String.raw`['"]next-intl(?:\/|['"])`
  ),
  teardownPackages: ['next-intl'],
  teardownConfigFiles: (routing: RoutingInfo) =>
    [routing.routingFile, routing.requestFile].filter(
      (file): file is string => file !== null
    ),
};
