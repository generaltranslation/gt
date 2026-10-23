import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/internal';

export const compileTimeHashDisabledWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'Compile-time hashing is disabled',
  wayOut:
    'The GT compiler will not run, so compiler optimizations are inactive',
});

export const autoJsxInjectionCompilerWarning = createDiagnosticMessage({
  source: 'gt-tanstack-start',
  severity: 'Warning',
  whatHappened: 'Automatic JSX injection requires the GT compiler',
  wayOut: 'Automatic JSX injection will be skipped',
  fix: "Set experimentalCompilerOptions.type to 'babel' and keep compileTimeHash enabled in gtTanstackStart()",
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
    fix: 'Remove apiKey and devApiKey from the file and set GT_API_KEY or VITE_GT_DEV_API_KEY in the environment instead',
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
