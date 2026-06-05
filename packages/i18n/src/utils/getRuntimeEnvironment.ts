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

  const importMetaEnv = (
    import.meta as ImportMeta & {
      env?: RuntimeEnvironment;
    }
  ).env;
  if (importMetaEnv?.MODE) {
    return importMetaEnv.MODE === 'development' ? 'development' : 'production';
  }
  if (importMetaEnv?.DEV === true) {
    return 'development';
  }

  return 'production';
}
