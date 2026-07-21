import type { MessageClass } from '../classifyMessage.js';
import type { TransformOptions } from '../transformSource.js';
import type {
  FileEdit,
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
  SourceResult,
} from '../types.js';
import type { SupportedLibraries } from '../../types/index.js';

/**
 * The per-source-library seam for `gt migrate`. Everything the transforms and
 * driver need to know about the library being migrated FROM lives here; the
 * gt-next target strings (GT_MODULE, GTProvider, gt-next/*) stay in the core
 * transforms because they are constant across every adapter.
 *
 * next-intl is adapter #1. The interface is intentionally additive: later
 * adapters (react-i18next, react-intl) extend it in their own PRs, and the
 * config-lane methods are optional so a source with no Next.js config lane
 * simply omits them.
 */
export interface SourceAdapter {
  /** the SupportedLibraries id this adapter migrates from. */
  id: SupportedLibraries;
  /** human-readable name, used only in report prose. */
  displayName: string;

  // --- module identity (replaces the scattered literals/regexes) ---
  /** true when an import source belongs to this library ('next-intl', 'next-intl/…'). */
  ownsModule(source: string): boolean;
  /** cheap text pre-check before parsing a source file. */
  mentionedIn(code: string): boolean;

  // --- symbol tables (the transformSource top-of-file constants) ---
  /** hooks kept by name, re-homed to gt-next (client). */
  clientSwaps: Set<string>;
  /** hooks kept by name, re-homed to gt-next/server. */
  serverSwaps: Set<string>;
  /** call statements deleted outright. */
  removals: Set<string>;
  /** provider-feeding hooks (useMessages/getMessages). */
  messagesHooks: Set<string>;
  /** locale-validation guard callees (hasLocale, …) whose guards the layout
   *  pass strips; treated as supported when dropLocaleValidation is set. */
  localeValidators: Set<string>;
  /** the client/server translation hook names (useTranslations/getTranslations). */
  translationHooks: { client: string; server: string };
  /** the client provider element name, or null when the library has none. */
  providerName: string | null;
  /** the routing-derived locale union type name, or null when absent. */
  localeType: string | null;

  // --- provider detection (the driver defers provider-bearing files) ---
  /** true when `code` renders this library's provider element (alias-aware). */
  hasProvider(code: string): boolean;

  // --- per-adapter source/layout codemod (optional) ---
  /**
   * Per-file source transform for a library whose call model does not fit the
   * shared next-intl engine (a hook that returns a `t('key')` function). When
   * present, transformSourceFile delegates to it wholesale (the single dispatch
   * site), so the driver and the layout pass stay adapter-agnostic.
   * next-intl omits it and runs the built-in engine.
   *
   * react-intl supplies one: its descriptor-object calls
   * (`intl.formatMessage({ id }, values)`) and formatter components
   * (`<FormattedMessage>`, `<FormattedNumber>`, …) have no next-intl analogue.
   * react-i18next supplies one: its client surface (`useTranslation`,
   * `t('ns:key')`, `<Trans>`, `i18n.changeLanguage`) is not expressible as
   * next-intl symbol-table swaps.
   *
   * `options` is the shared TransformOptions both adapters and the core engine
   * read: `retainProvider` keeps the source library's provider so
   * deferred/skipped files still resolve translations, and `dropLocaleValidation`
   * treats the locale guard as supported (its guard is removed by the layout
   * pass).
   */
  transformSource?(
    file: string,
    code: string,
    ctx: MigrationContext,
    options: TransformOptions
  ): SourceResult;
  /** Layout-specific codemod. When absent, the core `transformLayoutFile` runs. */
  transformLayout?(
    file: string,
    code: string,
    ctx: MigrationContext
  ): SourceResult;

  // --- message format ---
  /** classifies a catalog message (ICU for next-intl). */
  classifyMessage(message: string): MessageClass;

  // --- routing + catalog discovery ---
  parseRoutingConfig(cwd: string): RoutingInfo;
  discoverCatalogs(
    cwd: string,
    routing: RoutingInfo
  ): Promise<MessageCatalogs | null>;

  // --- config lane (each optional; absent => that lane is skipped) ---
  /**
   * Navigation-wrapper handling. The detector and the transform live together
   * in one optional member so an adapter can never wire one half without the
   * other: supply the whole object or omit it entirely. Absent => navigation
   * files fall through to the generic source transform.
   */
  navigation?: {
    /** true when a scanned file is this library's navigation wrapper. */
    isNavigationFile(code: string): boolean;
    transformNavigation(
      file: string,
      code: string,
      ctx: MigrationContext
    ): SourceResult;
  };
  transformNextConfig?(
    file: string,
    code: string,
    ctx: MigrationContext
  ): SourceResult;
  transformMiddleware?(
    file: string,
    code: string,
    ctx: MigrationContext
  ): SourceResult;
  transformRequestConfig?(file: string, code: string): SourceResult;

  // --- config-lane file identity (relative candidates resolved by the driver) ---
  /** next.config.* candidate paths, relative to the project root. */
  nextConfigCandidates: string[];
  /** middleware/proxy candidate paths, relative to the project root. */
  middlewareCandidates: string[];

  // --- catalog emission (optional) ---
  /**
   * Emits the converted catalog files. next-intl leaves catalogs in place (no
   * hook); react-i18next writes the ICU-merged per-locale dictionaries produced
   * by discoverCatalogs into a new directory and records the conversion reports
   * as TODOs. Called during the emit phase so writes respect --dry-run.
   */
  emitCatalogs?(ctx: MigrationContext): FileEdit[];

  // --- teardown ---
  /** whole-project "still uses this library" scan (the teardown blocker). */
  projectUsagePattern: RegExp;
  /** package.json dependency keys removed on a full migration. */
  teardownPackages: string[];
  /** config files deleted on a full migration (existence checked by the caller). */
  teardownConfigFiles(routing: RoutingInfo): string[];
}
