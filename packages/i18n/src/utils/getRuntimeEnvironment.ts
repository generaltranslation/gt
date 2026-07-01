export type RuntimeEnvironment = {
  DEV?: boolean;
  MODE?: string;
  NODE_ENV?: string;
};

export function getRuntimeEnvironment(): 'development' | 'production' {
  // We have to explicitly check `process.env.NODE_ENV` because it often gets string-replaced by bundler.
  // Destructuring or checking via other means may not work as expected.
  if (typeof process === 'object' && process.env?.NODE_ENV === 'development') {
    return 'development';
  }

  const importMetaMode = readImportMetaEnv(
    () =>
      (
        import.meta as ImportMeta & {
          env?: RuntimeEnvironment;
        }
      ).env?.MODE
  );
  if (importMetaMode) {
    return importMetaMode === 'development' ? 'development' : 'production';
  }
  if (
    readImportMetaEnv(
      () =>
        (
          import.meta as ImportMeta & {
            env?: RuntimeEnvironment;
          }
        ).env?.DEV
    ) === true
  ) {
    return 'development';
  }

  return 'production';
}

function readImportMetaEnv<T>(readValue: () => T | undefined): T | undefined {
  try {
    return readValue();
  } catch {
    return undefined;
  }
}
