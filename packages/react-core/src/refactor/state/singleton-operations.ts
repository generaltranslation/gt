import { ReactI18nManager } from "./ReactI18nManager";
import { createConditionStoreSingleton } from "gt-i18n/internal";
import { ReactConditionStore } from "./ReactConditionStore";
import {
  getI18nManager as getI18nManagerInternal,
  setI18nManager as setI18nManagerInternal,
} from "gt-i18n/internal";
import type { ReactI18nManagerConstructorParams } from "./ReactI18nManager";

// ===== Condition Store ===== //

export const { getConditionStore, setConditionStore } =
  createConditionStoreSingleton<ReactConditionStore>(
    "GT has not been initialized. Cannot access condition store.",
  );

// ===== I18n Manager ===== //

export function getI18nManager(): ReactI18nManager {
  return getI18nManagerInternal() as ReactI18nManager;
}

export function setI18nManager(i18nManager: ReactI18nManager): void {
  setI18nManagerInternal(i18nManager);
}

// ===== Render Strategy ===== //

type RenderStrategy = "SPA" | "server-render";

declare global {
  var __gt_renderStrategy: RenderStrategy | undefined;
}
export function getRenderStrategy(): RenderStrategy {
  if (!globalThis.__gt_renderStrategy) {
    throw new Error(
      "GT has not been initialized. Cannot access render strategy.",
    );
  }
  return globalThis.__gt_renderStrategy;
}

function setRenderStrategy(renderStrategy: RenderStrategy): void {
  globalThis.__gt_renderStrategy = renderStrategy;
}

// ===== Initialize State ===== //

/**
 * Hard requires the existance of translations and a locale
 */
export function initializeState({
  locale,
  translations,
  config,
  renderStrategy,
}: {
  locale: string;
  translations: Record<string, string>;
  renderStrategy: RenderStrategy;
  config: ReactI18nManagerConstructorParams;
}): void {
  setRenderStrategy(renderStrategy);

  const i18nManager = new ReactI18nManager(config);
  setI18nManager(i18nManager);

  const conditionStore = new ReactConditionStore({
    defaultLocale: config.defaultLocale,
    locales: config.locales,
    customMapping: config.customMapping,
    locale,
  });
  setConditionStore(conditionStore);
}
