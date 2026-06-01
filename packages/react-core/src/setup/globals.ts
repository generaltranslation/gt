/**
 * Helps us distinguish behavior for SPA vs server-rendered apps
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
export type RenderStrategy = 'SPA' | 'server-rendered';

declare global {
  interface GeneralTranslationGlobal {
    reactCore?: {
      renderStrategy?: RenderStrategy;
    };
  }

  var __generaltranslation: GeneralTranslationGlobal | undefined;
}

function getReactCoreGlobals() {
  globalThis.__generaltranslation ??= {};
  globalThis.__generaltranslation.reactCore ??= {};
  return globalThis.__generaltranslation.reactCore;
}

/**
 * TODO: better error message (createDiagnosticMessage)
 * TODO: move to `I18nConfig`
 * @deprecated - move to I18nConfig
 */
export function getRenderStrategy(): RenderStrategy {
  const { renderStrategy } = getReactCoreGlobals();
  if (!renderStrategy) {
    throw new Error(
      'Cannot access render strategy. GT has not been initialized.'
    );
  }
  return renderStrategy;
}

export function setRenderStrategy(renderStrategy: RenderStrategy): void {
  getReactCoreGlobals().renderStrategy = renderStrategy;
}
