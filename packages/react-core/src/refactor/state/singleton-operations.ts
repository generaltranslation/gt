import {
  ReactI18nManager,
  ReactI18nManagerConstructorParams,
} from "./ReactI18nManager";
import {
  getI18nManager as getI18nManagerInternal,
  setI18nManager as setI18nManagerInternal,
} from "gt-i18n/internal";

// ===== I18n Manager ===== //

export function getI18nManager(): ReactI18nManager {
  return getI18nManagerInternal() as ReactI18nManager;
}

export function setI18nManager(i18nManager: ReactI18nManager): void {
  setI18nManagerInternal(i18nManager);
}

// ===== Globals ===== //

/**
 * Helps us distinguish behavior for SPA vs server-rendered apps
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
type RenderStrategy = "SPA" | "server-render";

declare global {
  var __generaltranslation: {
    renderStrategy: RenderStrategy | undefined;
  };
}

globalThis.__generaltranslation = {
  renderStrategy: undefined,
};

export function getRenderStrategy(): RenderStrategy {
  if (!globalThis.__generaltranslation.renderStrategy) {
    throw new Error(
      "Cannot access render strategy. GT has not been initialized.",
    );
  }
  return globalThis.__generaltranslation.renderStrategy;
}

// ===== Initialize State ===== //

/**
 * Hard requires the existance of initialTranslations and a locale
 */
export function initializeState({
  locale,
  config,
  renderStrategy,
}: {
  locale: string;
  renderStrategy: RenderStrategy;
  config: ReactI18nManagerConstructorParams;
}): void {
  globalThis.__generaltranslation.renderStrategy = renderStrategy;

  const i18nManager = new ReactI18nManager(config);
  setI18nManager(i18nManager);
}
