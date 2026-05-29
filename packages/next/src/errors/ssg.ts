import {
  createGtNextDiagnostic,
  formatDiagnosticErrorDetails,
} from './diagnostics';
import { RequestFunctions, StaticRequestFunctions } from '../request/types';

// ========== ERRORS ========== //

export const ssgMissingGetStaticLocaleFunctionError = createGtNextDiagnostic({
  whatHappened: 'SSG is enabled, but getStaticLocale() is not configured',
  fix: 'Define getStaticLocale() so gt-next can resolve locales during static generation',
  docsUrl: 'https://generaltranslation.com/en/docs/next/guides/ssg',
});

// ========== WARNINGS ========== //

// This was (1) triggered by SSG without running middleware, or (2) triggered by a request with no locale headers (also no middleware).
export const noLocalesCouldBeDeterminedWarning = createGtNextDiagnostic({
  whatHappened: 'No locale could be determined for this request',
  wayOut: 'gt-next will fall back to the default locale',
  fix: 'If you use SSG, configure locale resolution',
  docsUrl:
    'https://generaltranslation.com/en/docs/next/guides/ssg#ssg-custom-get-locale',
});

const createCustomSSGFunctionSuffix = (functionName: StaticRequestFunctions) =>
  `To use ${functionName.replace('Static', '')} during SSG, define a custom ${functionName.replace('Static', '')}() function. For more information, visit https://generaltranslation.com/en/docs/next/guides/ssg.`;

export const createSsgMissingCustomFunctionWarning = (
  functionName: StaticRequestFunctions
) =>
  `gt-next: ${functionName.replace('Static', '')}() was invoked during SSG. ${createCustomSSGFunctionSuffix(functionName)}`;

export const invalidSSGConfigurationWarning = createGtNextDiagnostic({
  whatHappened: 'SSG is in use, but withGTConfig() is not configured for SSG',
  fix: 'Add the SSG configuration before building static localized pages',
  docsUrl: 'https://generaltranslation.com/en/docs/next/guides/ssg',
});

export const createGetRequestFunctionWarning = (
  functionName: RequestFunctions | StaticRequestFunctions,
  error?: unknown
) =>
  createGtNextDiagnostic({
    whatHappened: `${functionName}() could not be resolved`,
    wayOut: 'gt-next will fall back where possible',
    fix: 'Check that the function is exported from the configured request file',
    details: formatDiagnosticErrorDetails(error),
  });

export const createCustomGetRequestFunctionWarning = (
  functionName: RequestFunctions | StaticRequestFunctions,
  error?: unknown
) =>
  createGtNextDiagnostic({
    whatHappened: `Custom ${functionName}() could not be resolved`,
    wayOut: 'gt-next will fall back where possible',
    fix: 'Check that the function is exported from the configured request file',
    details: formatDiagnosticErrorDetails(error),
  });

export const createSsrFunctionDuringSsgWarning = (
  functionName: RequestFunctions
) =>
  createGtNextDiagnostic({
    whatHappened: `${functionName}() was invoked during SSG`,
    wayOut: 'Rendering will likely fall back to SSR behavior',
    fix: 'Define a static locale function to avoid this fallback',
  });

export const createSsrDetectionFailedWarning = (error: unknown) =>
  createGtNextDiagnostic({
    whatHappened: 'The runtime mode could not be determined as SSR or SSG',
    wayOut: 'gt-next will fall back to SSR behavior',
    details: formatDiagnosticErrorDetails(error),
  });

export const deprecatedExperimentalEnableSSGWarning = createGtNextDiagnostic({
  whatHappened:
    'experimentalEnableSSG is deprecated and will be removed in a future version',
  fix: 'Define custom getLocalePath and getRegionPath request functions instead',
});
