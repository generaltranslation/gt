/**
 * Helps us distinguish behavior for SPA vs server-rendered apps
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
export type RenderStrategy = 'SPA' | 'server-render';

declare global {
  var __generaltranslation: {
    renderStrategy: RenderStrategy | undefined;
    /**
     * @deprecated use a dedicated function instead instead of second source of truth
     */
    i18nStoreInitialized: boolean;
  };
}

globalThis.__generaltranslation = {
  renderStrategy: undefined,
  i18nStoreInitialized: false,
};

export function getRenderStrategy(): RenderStrategy {
  if (!globalThis.__generaltranslation.renderStrategy) {
    throw new Error(
      'Cannot access render strategy. GT has not been initialized.'
    );
  }
  return globalThis.__generaltranslation.renderStrategy;
}

/**
 * @deprecated - switch to a better way to track initialization
 */
export function getI18nStoreInitialized(): boolean {
  return globalThis.__generaltranslation.i18nStoreInitialized;
}

export function setRenderStrategy(renderStrategy: RenderStrategy): void {
  globalThis.__generaltranslation.renderStrategy = renderStrategy;
}

/**
 * @deprecated - switch to a better way to track initialization
 */
export function setStoresInitialized(storesInitialized: boolean): void {
  globalThis.__generaltranslation.i18nStoreInitialized = storesInitialized;
}
