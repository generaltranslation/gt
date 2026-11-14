import type { SupportedReactFrameworks } from '../../types/index.js';
import {
  NEXT_APP_QUICKSTART_URL,
  NEXT_PAGES_QUICKSTART_URL,
  REACT_QUICKSTART_URL,
} from '../../utils/constants.js';
import { reactRouterSetup } from './reactRouter/index.js';
import { tanstackStartSetup } from './tanstackStart/index.js';
import type { ViteCredentialsRuntime } from './shared/viteConfig.js';
import { viteSetup } from './vite.js';

/** A change setup left to a person, reported as a warning. */
export type ManualAction = { whatHappened: string; fix: string };

/** What a build-tool hook changed, and what a person still has to do. */
export type SetupResult = { steps: string[]; manualActions: ManualAction[] };

export type BuildToolContext = {
  appDirectory: string;
  configFilepath: string;
  defaultLocale: string;
  locales: string[];
  /** Set when translations are stored locally. */
  translationsDir?: string;
  /** The translations directory in the existing config. */
  previousTranslationsDir?: string;
};

/** Setup steps for a build tool whose app entry GT configures itself. */
export type BuildToolSetup = {
  framework: SupportedReactFrameworks;
  defaultTranslationsDir: string;
  /** The runtime entry named in the defaults text. */
  initializer: string;
  /** Loads local translations itself instead of loadTranslations.js. */
  ownsLoader: boolean;
  skipsGTInstall(isUsingGT: boolean): boolean;
  /** Setup guide linked after setup; the React quickstart otherwise. */
  docsUrl?: string;
  /** The development credentials question asked with local storage. */
  devCredentialsOption: '--live-translations' | '--dev-credentials';
  /** Rejects an app layout it cannot configure, before any change. */
  preflight(appDirectory: string): Promise<void>;
  /** Keeps an existing loader in sync when the React setup is skipped. */
  syncLoader(
    ctx: BuildToolContext & { translationsDir: string; keepAppSource?: boolean }
  ): Promise<SetupResult>;
  /**
   * The change a configured app entry needs after translations switch to the
   * CDN: null when it needs none, undefined to keep the generic loader-removal
   * action.
   */
  getCDNStorageAction?(
    ctx: BuildToolContext
  ): Promise<ManualAction | null | undefined>;
  /**
   * Reports the runtime's Vite plugin that saved credentials need, without
   * editing any file, when the React setup is skipped.
   */
  checkCredentialsPlugin?(
    appDirectory: string,
    runtime: ViteCredentialsRuntime
  ): Promise<SetupResult>;
  /** Configures the app entry after gt.config.json is written. */
  apply(ctx: BuildToolContext): Promise<SetupResult>;
};

export const BUILD_TOOL_SETUPS: BuildToolSetup[] = [
  viteSetup,
  tanstackStartSetup,
  reactRouterSetup,
];

export function getBuildToolSetup(
  framework?: string
): BuildToolSetup | undefined {
  return BUILD_TOOL_SETUPS.find((setup) => setup.framework === framework);
}

/** Quickstarts for frameworks set up without a build-tool hook. */
const FRAMEWORK_DOCS_URLS: Partial<Record<string, string>> = {
  'next-app': NEXT_APP_QUICKSTART_URL,
  'next-pages': NEXT_PAGES_QUICKSTART_URL,
} satisfies Partial<Record<SupportedReactFrameworks, string>>;

/** The setup guide the wizard links for a framework. */
export function getSetupDocsUrl(framework?: string): string {
  return (
    getBuildToolSetup(framework)?.docsUrl ??
    (framework && FRAMEWORK_DOCS_URLS[framework]) ??
    REACT_QUICKSTART_URL
  );
}
