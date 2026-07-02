export type GeneralTranslationLogLevel = string | undefined;

type LogLevelEnvironment = {
  _GENERALTRANSLATION_LOG_LEVEL?: string;
};

const debugLogLevel = 'DEBUG';

export function getGeneralTranslationLogLevel(): GeneralTranslationLogLevel {
  const processLogLevel = readProcessEnvLogLevel();
  if (processLogLevel !== undefined) {
    return processLogLevel;
  }

  return readImportMetaEnv(
    () =>
      (
        import.meta as ImportMeta & {
          env?: LogLevelEnvironment;
        }
      ).env?._GENERALTRANSLATION_LOG_LEVEL
  );
}

export function isDebugLogLevel(logLevel: GeneralTranslationLogLevel): boolean {
  return logLevel === debugLogLevel;
}

function readProcessEnvLogLevel(): GeneralTranslationLogLevel {
  if (typeof process !== 'object') {
    return undefined;
  }
  return process.env?._GENERALTRANSLATION_LOG_LEVEL;
}

function readImportMetaEnv<T>(readValue: () => T | undefined): T | undefined {
  try {
    return readValue();
  } catch {
    return undefined;
  }
}
