import { createDiagnosticMessage } from 'generaltranslation/internal';
import {
  getI18nConfig as getBaseI18nConfig,
  I18nConfig,
  setI18nConfig as setBaseI18nConfig,
} from 'gt-i18n/internal';
import type { I18nConfigParams as BaseI18nConfigParams } from 'gt-i18n/internal/types';

/**
 * Cookie name for tracking the user's selected locale.
 */
export const defaultLocaleCookieName = 'generaltranslation.locale';

/**
 * Cookie name for tracking the user's selected region.
 */
export const defaultRegionCookieName = 'generaltranslation.region';

/**
 * Cookie name for persisting the enableI18n feature flag.
 */
export const defaultEnableI18nCookieName = 'generaltranslation.enable-i18n';

/**
 * Cookie name for tracking the locale reset.
 */
export const defaultResetLocaleCookieName = 'generaltranslation.locale-reset';

/**
 * Helps us distinguish behavior for SPA vs server-rendered apps.
 * - server-rendered apps must use context
 * - SPA apps can synchronously access the locale
 */
export type RenderStrategy = 'SPA' | 'server-render';

type CookieNameConfig = {
  localeCookieName?: string;
  regionCookieName?: string;
  enableI18nCookieName?: string;
};

export type ReactI18nConfigParams = BaseI18nConfigParams & CookieNameConfig;

const defaultRenderStrategy: RenderStrategy = 'server-render';
const reactI18nConfigBrand = Symbol.for(
  'generaltranslation.react-core.ReactI18nConfig'
);

export class ReactI18nConfig extends I18nConfig {
  private renderStrategy: RenderStrategy;
  private localeCookieName: string;
  private regionCookieName: string;
  private enableI18nCookieName: string;

  constructor(
    params: ReactI18nConfigParams = {},
    renderStrategy: RenderStrategy = defaultRenderStrategy
  ) {
    super(params);
    validateRenderStrategy(renderStrategy);
    Object.defineProperty(this, reactI18nConfigBrand, { value: true });
    this.renderStrategy = renderStrategy;
    this.localeCookieName = params.localeCookieName ?? defaultLocaleCookieName;
    this.regionCookieName = params.regionCookieName ?? defaultRegionCookieName;
    this.enableI18nCookieName =
      params.enableI18nCookieName ?? defaultEnableI18nCookieName;
  }

  getRenderStrategy(): RenderStrategy {
    return this.renderStrategy;
  }

  getLocaleCookieName(): string {
    return this.localeCookieName;
  }

  getRegionCookieName(): string {
    return this.regionCookieName;
  }

  getEnableI18nCookieName(): string {
    return this.enableI18nCookieName;
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
      fix: 'Initialize GT through gt-react or @generaltranslation/react-core/pure.',
    })
  );
}

export function setI18nConfig(nextI18nConfig: ReactI18nConfig): void {
  setBaseI18nConfig(nextI18nConfig);
}

export function initializeI18nConfig(
  params: ReactI18nConfigParams = {},
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
  if (i18nConfig instanceof ReactI18nConfig) return true;

  const maybeReactI18nConfig = i18nConfig as I18nConfig &
    Record<PropertyKey, unknown>;
  return (
    maybeReactI18nConfig[reactI18nConfigBrand] === true &&
    typeof maybeReactI18nConfig.getRenderStrategy === 'function' &&
    typeof maybeReactI18nConfig.getLocaleCookieName === 'function' &&
    typeof maybeReactI18nConfig.getRegionCookieName === 'function' &&
    typeof maybeReactI18nConfig.getEnableI18nCookieName === 'function'
  );
}
