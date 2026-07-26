import { classifyMessage } from '../catalogs/classifyMessage.js';
import { makeProviderDetector } from './providerDetector.js';
import type { RoutingInfo } from '../pipeline/types.js';
import { discoverReactIntlCatalogs } from '../catalogs/reactIntlCatalogs.js';
import { transformReactIntlNextConfig } from '../transforms/reactIntlNextConfig.js';
import {
  REACT_INTL_TEARDOWN_PACKAGES,
  transformReactIntlSource,
} from '../transforms/reactIntlTransform.js';
import { MODULE_SPECIFIER_PREFIX_SOURCE } from '../fs/moduleSpecifiers.js';
import type { SourceAdapter } from './types.js';

const PROVIDER = 'IntlProvider';

/** true when an import source is react-intl or a FormatJS runtime subpath. */
function ownsModule(source: string): boolean {
  return source === 'react-intl' || source.startsWith('@formatjs/');
}

/**
 * True when `code` renders a react-intl <IntlProvider> imported from react-intl
 * (alias-aware). The driver uses this to defer provider-bearing non-layout
 * files: their provider-retention decision (unwrap vs keep) depends on the final
 * skip set. Cheap-exits before parsing when the provider name is absent.
 */
const hasProvider = makeProviderDetector(PROVIDER, ownsModule);

/**
 * react-intl has no routing-config file (no defineRouting analogue); locales are
 * inferred from the catalog directory and the default locale from an
 * IntlProvider/createIntl `defaultLocale` prop during catalog discovery.
 */
function parseRoutingConfig(_cwd: string): RoutingInfo {
  return {
    locales: null,
    defaultLocale: null,
    localePrefix: null,
    pathnames: null,
    routingFile: null,
    requestFile: null,
  };
}

/**
 * Adapter #2: react-intl (FormatJS) -> gt-next. Because react-intl's call model
 * (descriptor-object formatMessage and formatter components) does not fit the
 * shared next-intl engine, this adapter supplies its own `transformSource`; the
 * driver and layout pass still funnel through it. Dictionary-compat
 * (catalogs reused verbatim); rich text skips until the follow-up inline pass.
 */
export const reactIntlAdapter: SourceAdapter = {
  id: 'react-intl',
  displayName: 'react-intl',
  missingKeyBehavior:
    'react-intl rendered the defaultMessage without logging, so a missing catalog entry was invisible; the keys that now fail the build are exactly the ones you could not notice before',

  ownsModule,
  mentionedIn: (code) => /['"](react-intl|@formatjs\/[^'"]*)['"]/.test(code),

  // The engine that reads these is bypassed by transformSource below; they are
  // present so the shared layout pass and report have sane values.
  clientSwaps: new Set(['useTranslations']),
  serverSwaps: new Set(['getTranslations']),
  removals: new Set(),
  messagesHooks: new Set(),
  localeValidators: new Set(),
  translationHooks: { client: 'useTranslations', server: 'getTranslations' },
  providerName: PROVIDER,
  localeType: null,

  hasProvider,
  classifyMessage,

  transformSource: transformReactIntlSource,

  parseRoutingConfig,
  discoverCatalogs: discoverReactIntlCatalogs,

  // No navigation wrapper, middleware, or request-config lanes in react-intl.
  transformNextConfig: transformReactIntlNextConfig,

  nextConfigCandidates: ['next.config.ts', 'next.config.js', 'next.config.mjs'],
  requiresServerProviderBoundary: true,
  middlewareCandidates: [],

  projectUsagePattern: new RegExp(
    MODULE_SPECIFIER_PREFIX_SOURCE +
      String.raw`['"](react-intl(?:\/|['"])|@formatjs\/)`
  ),
  teardownPackages: REACT_INTL_TEARDOWN_PACKAGES,
  // react-intl has no dedicated config file safe to delete (a .babelrc may hold
  // unrelated plugins); the FormatJS build plugin is torn down in next.config.
  teardownConfigFiles: (_routing: RoutingInfo) => [],
};
