/**
 * Helps us distinguish behavior for SPA vs server-rendered apps
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
export type RenderStrategy = 'SPA' | 'server-render';

declare global {
  var __generaltranslation: {
    renderStrategy: RenderStrategy | undefined;
    storesInitialized: boolean;
  };
}

globalThis.__generaltranslation = {
  renderStrategy: undefined,
  storesInitialized: false,
};

export function getRenderStrategy(): RenderStrategy {
  if (!globalThis.__generaltranslation.renderStrategy) {
    throw new Error(
      'Cannot access render strategy. GT has not been initialized.'
    );
  }
  return globalThis.__generaltranslation.renderStrategy;
}

export function storesInitialized(): boolean {
  return globalThis.__generaltranslation.storesInitialized;
}

export function setRenderStrategy(renderStrategy: RenderStrategy): void {
  globalThis.__generaltranslation.renderStrategy = renderStrategy;
}

export function setStoresInitialized(storesInitialized: boolean): void {
  globalThis.__generaltranslation.storesInitialized = storesInitialized;
}
