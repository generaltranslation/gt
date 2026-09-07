import type { ParsingConfigOptions } from '../../../../../types/parsing.js';

/** Add the auto-JSX project selection without copying caller-owned accessors. */
export function withAutoJsxProjectConfig(
  options: ParsingConfigOptions,
  configFile?: string
): ParsingConfigOptions {
  return {
    // Access the original object lazily so inherited/private getters retain
    // their receiver and resolution options are read only when needed.
    get conditionNames() {
      return options.conditionNames;
    },
    get jsxProjectConfigPath() {
      return configFile || options.jsxProjectConfigPath;
    },
  };
}
