export type RuntimeEnvironment = {
  DEV?: boolean;
  MODE?: string;
  NODE_ENV?: string;
};

export function getRuntimeEnvironment(): "development" | "production" {
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  if (processEnv?.NODE_ENV === "development") {
    return "development";
  }

  const importMetaEnv = (
    import.meta as ImportMeta & {
      env?: RuntimeEnvironment;
    }
  ).env;
  if (importMetaEnv?.MODE) {
    return importMetaEnv.MODE === "development" ? "development" : "production";
  }
  if (importMetaEnv?.DEV === true) {
    return "development";
  }

  return "production";
}
