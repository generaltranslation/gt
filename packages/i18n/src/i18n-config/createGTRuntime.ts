import { GTRuntime, type GTProjectConfig } from 'generaltranslation/runtime';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { I18nConfig } from './I18nConfig';
import { getI18nConfig } from './singleton-operations';

/**
 * Constructor params for the runtime translation client. Each framework's
 * initialization resolves the credentials, from its config and then its
 * environment.
 *
 * @throws {Error} Without a projectId or an API key.
 */
export function getTranslationRuntimeParams(
  config: I18nConfig = getI18nConfig()
): GTProjectConfig {
  const { projectId, apiKey, runtimeUrl } = config.getRuntimeConfig();
  if (!projectId) throw new Error(createMissingRuntimeProjectIdError());
  if (!apiKey) throw new Error(createMissingRuntimeApiKeyError());
  return {
    apiKey,
    projectId,
    baseUrl: runtimeUrl || undefined,
    localeConfig: config,
  };
}

/**
 * The runtime translation client, kept outside I18nConfig so only code that
 * translates at runtime bundles the API client.
 *
 * @throws {Error} Without a projectId or an API key.
 */
export function createGTRuntime(
  config: I18nConfig = getI18nConfig()
): GTRuntime {
  return new GTRuntime(getTranslationRuntimeParams(config));
}

const createMissingRuntimeProjectIdError = () =>
  createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: 'Runtime translation needs a projectId',
    fix: "Set `projectId` in your framework's GT configuration, or disable runtime translation",
  });

const createMissingRuntimeApiKeyError = () =>
  createDiagnosticMessage({
    source: 'gt-i18n',
    severity: 'Error',
    whatHappened: 'Runtime translation needs an API key',
    fix: "Set `apiKey` in your framework's GT configuration or the GT_API_KEY environment variable, or disable runtime translation",
  });
