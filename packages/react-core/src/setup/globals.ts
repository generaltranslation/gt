/**
 * Helps us distinguish behavior for SPA vs server-rendered apps
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
export type RenderStrategy = 'SPA' | 'server-render';

declare global {
  var __generaltranslation: {
    renderStrategy: RenderStrategy | undefined;
  };
}

globalThis.__generaltranslation = {
  renderStrategy: undefined,
};

/**
 * TODO: better error message (createDiagnosticMessage)
 * TODO: move to `I18nConfig`
 * @deprecated - move to I18nConfig
 */
export function getRenderStrategy(): RenderStrategy {
  if (!globalThis.__generaltranslation.renderStrategy) {
    throw new Error(
      'Cannot access render strategy. GT has not been initialized.'
    );
  }
  return globalThis.__generaltranslation.renderStrategy;
}

export function setRenderStrategy(renderStrategy: RenderStrategy): void {
  globalThis.__generaltranslation.renderStrategy = renderStrategy;
}
