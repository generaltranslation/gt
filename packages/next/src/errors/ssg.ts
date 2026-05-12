import { DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY } from '../config-dir/props/withGTConfigProps';
import { RequestFunctions, StaticRequestFunctions } from '../request/types';
import { createDiagnosticMessage } from './diagnostics';

// ========== ERRORS ========== //

export const ssgMissingGetStaticLocaleFunctionError = createDiagnosticMessage({
  source: 'gt-next',
  whatHappened: 'SSG is enabled, but getStaticLocale() is not configured',
  fix: 'Define getStaticLocale() so gt-next can resolve locales during static generation',
  docsUrl: 'https://generaltranslation.com/en/docs/next/guides/ssg',
});

// ========== WARNINGS ========== //

// This was (1) triggered by SSG without running middleware, or (2) triggered by a request with no locale headers (also no middleware).
export const noLocalesCouldBeDeterminedWarning = createDiagnosticMessage({
  source: 'gt-next',
  whatHappened: 'No locale could be determined for this request',
  wayOut: 'gt-next will fall back to the default locale',
  fix: 'If you use SSG, configure locale resolution',
  docsUrl:
    'https://generaltranslation.com/en/docs/next/guides/ssg#ssg-custom-get-locale',
});

const createCustomSSGFunctionSuffix = (functionName: StaticRequestFunctions) =>
  `To use ${functionName.replace('Static', '')} during SSG, define a custom ${functionName.replace('Static', '')}() function. For more information, visit https://generaltranslation.com/en/docs/next/guides/ssg. To disable this warning, set "disableSSGWarnings" to true.`;

export const createSsgMissingCustomFunctionWarning = (
  functionName: StaticRequestFunctions
) =>
  process.env._GENERALTRANSLATION_DISABLE_SSG_WARNINGS === 'true'
    ? ''
    : `gt-next: ${functionName.replace('Static', '')}() was invoked during SSG. ${createCustomSSGFunctionSuffix(functionName)}`;

export const invalidSSGConfigurationWarning = createDiagnosticMessage({
  source: 'gt-next',
  whatHappened: 'SSG is in use, but withGTConfig() is not configured for SSG',
  fix: 'Add the SSG configuration before building static localized pages',
  docsUrl: 'https://generaltranslation.com/en/docs/next/guides/ssg',
});

export const createGetRequestFunctionWarning = (
  functionName: RequestFunctions | StaticRequestFunctions
) =>
  createDiagnosticMessage({
    source: 'gt-next',
    whatHappened: `${functionName}() could not be resolved`,
    wayOut: 'gt-next will fall back where possible',
    fix: 'Check that the function is exported from the configured request file',
  });

export const createCustomGetRequestFunctionWarning = (
  functionName: RequestFunctions | StaticRequestFunctions
) =>
  createDiagnosticMessage({
    source: 'gt-next',
    whatHappened: `Custom ${functionName}() could not be resolved`,
    wayOut: 'gt-next will fall back where possible',
    fix: 'Check that the function is exported from the configured request file',
  });

export const createSsrFunctionDuringSsgWarning = (
  functionName: RequestFunctions
) =>
  process.env._GENERALTRANSLATION_DISABLE_SSG_WARNINGS === 'true'
    ? ''
    : createDiagnosticMessage({
        source: 'gt-next',
        whatHappened: `${functionName}() was invoked during SSG`,
        wayOut: 'Rendering will likely fall back to SSR behavior',
        fix: 'Define a static locale function to avoid this fallback',
      });

export const ssrDetectionFailedWarning = createDiagnosticMessage({
  source: 'gt-next',
  whatHappened: 'The runtime mode could not be determined as SSR or SSG',
  wayOut: 'gt-next will fall back to SSR behavior',
});

export const deprecatedExperimentalEnableSSGWarning = createDiagnosticMessage({
  source: 'gt-next',
  whatHappened:
    'experimentalEnableSSG is deprecated and will be removed in a future version',
  fix: 'Move to experimentalLocaleResolution when you update your SSG configuration',
});

export const createDeprecatedGetStaticLocaleFunctionWarning = (
  functionName: keyof typeof DEPRECATED_REQUEST_FUNCTION_TO_CONFIG_KEY
) =>
  `gt-next: ${functionName} is deprecated. Use ${functionName.replace('Static', '')} instead.`;
