import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';

export const autoJsxInjectionCompilerWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'Automatic JSX injection requires the GT compiler',
  wayOut: 'Automatic JSX injection will be skipped',
  fix: "Set experimentalCompilerOptions.type to 'babel' in gtTanstackStart()",
});

export function createCompilerUnresolvedWarning(error: unknown): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: 'The GT babel compiler could not be resolved',
    wayOut: 'Skipping compiler optimizations',
    details: formatDiagnosticErrorDetails(error),
  });
}

export const splitRequiresCompilerError = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Error',
  whatHappened:
    "experimentalSplitTranslations is on and experimentalCompilerOptions.type is 'none'",
  why: 'the GT compiler is what splits translations',
  fix: "Remove type from experimentalCompilerOptions in gtTanstackStart(), or set it to 'babel'",
  wayOut: 'turn experimentalSplitTranslations off',
});

export function createSplitCustomLoaderError(file: string): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened: `experimentalSplitTranslations cannot be used with the loadTranslations of ${file}`,
    why: 'the build writes the translations a navigation loads from the files at files.gt.output, and the server would render a first visit from what that loader returns, which can be other translations or other locales',
    fix: `Remove ${file} and the loadTranslationsPath option, so every translation comes from files.gt.output`,
    wayOut: 'turn experimentalSplitTranslations off',
  });
}

export function createSplitServerMessagesError(): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened:
      'experimentalSplitTranslations could not give the server the messages of its own code',
    why: 'no chunk of the server build holds the place they are written into',
    fix: 'Report this defect of the build to General Translation',
    wayOut: 'turn experimentalSplitTranslations off',
  });
}

export function createSplitOrderError(): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened:
      'experimentalSplitTranslations cannot give the server the translation files of the client build',
    why: 'the server was built before the client, and gt-tanstack-start reads what the client build wrote while it builds the server',
    fix: 'Build the client environment before the ssr environment, as TanStack Start does',
    wayOut: 'turn experimentalSplitTranslations off',
  });
}

export const duplicateCompilerWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'The GT compiler plugin is registered more than once',
  why: 'gtTanstackStart() already includes the GT compiler',
  fix: 'Remove the separate GT compiler plugin from your Vite plugins',
  wayOut: "set experimentalCompilerOptions.type to 'none' in gtTanstackStart()",
});

export function createInvalidExportError(
  file: string,
  what: string,
  expected: string
): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Error',
    whatHappened: `${file} does not export ${what}`,
    fix: `In that file, export a default or named ${expected}`,
  });
}

export function createMissingFileError(option: string, file: string): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt-tanstack-start',
      severity: 'Error',
      whatHappened: `The gtTanstackStart() ${option} option points to ${file}, which does not exist`,
      fix: `Create the file, or set ${option} to its path relative to the working directory`,
    })
  );
}

export function createConfigChangedWarning(configFileName: string): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: `${configFileName} changed, but the running dev server keeps the version it read at startup`,
    fix: 'Stop the dev server and start it again to apply the change',
  });
}

export function createApiKeysOmittedWarning(configFileName: string): string {
  return createDiagnosticMessage({
    source: 'gt-tanstack-start',
    severity: 'Warning',
    whatHappened: `${configFileName} contains an API key, which gtTanstackStart() leaves out of the generated config so it is not published to the browser`,
    fix: 'Remove apiKey and devApiKey from the file and set GT_API_KEY in the environment or a .env file instead; gtTanstackStart() exposes it to the browser only in the dev server',
  });
}

export function createConfigReadError(
  configFile: string,
  error: unknown
): Error {
  return new Error(
    createDiagnosticMessage({
      source: 'gt-tanstack-start',
      severity: 'Error',
      whatHappened: 'Failed to read gt.config.json',
      fix: 'Check that the file exists and contains valid JSON, or point the gtTanstackStart() config option at it',
      details: [configFile, formatDiagnosticErrorDetails(error)].filter(
        (detail): detail is string => detail !== undefined
      ),
    })
  );
}
