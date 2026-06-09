import { createDiagnosticMessage } from 'generaltranslation/internal';
import {
  getI18nConfig as getBaseI18nConfig,
  I18nConfig,
  setI18nConfig as setBaseI18nConfig,
} from 'gt-i18n/internal';
import type { I18nConfigParams } from 'gt-i18n/internal/types';

/**
 * Helps us distinguish behavior for SPA vs server-rendered apps.
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
export type RenderStrategy = 'SPA' | 'server-render';

const defaultRenderStrategy: RenderStrategy = 'server-render';

export class ReactI18nConfig extends I18nConfig {
  private renderStrategy: RenderStrategy;

  constructor(
    params: I18nConfigParams = {},
    renderStrategy: RenderStrategy = defaultRenderStrategy
  ) {
    super(params);
    validateRenderStrategy(renderStrategy);
    this.renderStrategy = renderStrategy;
  }

  getRenderStrategy(): RenderStrategy {
    return this.renderStrategy;
  }
}

export function getI18nConfig(): ReactI18nConfig {
  const i18nConfig = getBaseI18nConfig();
  if (isReactI18nConfig(i18nConfig)) {
    return i18nConfig;
  }
  throw new Error(
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'Cannot read ReactI18nConfig after base I18nConfig setup.',
      why: 'the internal I18nConfig singleton was initialized without react-core render strategy support',
      fix: 'Initialize GT through gt-react or @generaltranslation/react-core/context.',
    })
  );
}

export function setI18nConfig(nextI18nConfig: ReactI18nConfig): void {
  setBaseI18nConfig(nextI18nConfig);
}

export function initializeI18nConfig(
  params: I18nConfigParams = {},
  renderStrategy: RenderStrategy = defaultRenderStrategy
): ReactI18nConfig {
  const nextI18nConfig = new ReactI18nConfig(params, renderStrategy);
  setI18nConfig(nextI18nConfig);
  return nextI18nConfig;
}

function validateRenderStrategy(
  renderStrategy: RenderStrategy
): asserts renderStrategy is RenderStrategy {
  if (renderStrategy === 'SPA' || renderStrategy === 'server-render') return;
  throw new Error(
    createDiagnosticMessage({
      source: '@generaltranslation/react-core',
      severity: 'Error',
      whatHappened: 'Invalid React render strategy.',
      why: `the render strategy must be "SPA" or "server-render", but received "${String(renderStrategy)}"`,
      fix: 'Initialize GT through gt-react or pass a valid render strategy.',
    })
  );
}

function isReactI18nConfig(
  i18nConfig: I18nConfig
): i18nConfig is ReactI18nConfig {
  return i18nConfig instanceof ReactI18nConfig;
}
