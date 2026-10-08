import type { SupportedReactFrameworks } from '../../types/index.js';
import { reactRouterSetup } from './reactRouter/index.js';
import { tanstackStartSetup } from './tanstackStart/index.js';
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
  /** CDN transition guidance; undefined keeps the generic loader-removal action. */
  getCDNStorageAction?(
    ctx: BuildToolContext
  ): Promise<ManualAction | undefined>;
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
