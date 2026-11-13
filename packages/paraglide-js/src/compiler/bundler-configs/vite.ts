import path from 'node:path';
import type { ImportAlias } from './alias.js';
import { configFileNames, type BundlerConfig } from './bundler-config.js';

/** The parts of Vite this uses. */
type Vite = {
  resolveConfig(
    inlineConfig: {
      configFile: string;
      plugins: readonly ConfigPlugin[];
      logLevel: 'silent';
    },
    command: 'build'
  ): Promise<ResolvedConfig>;
};

type ConfigPlugin = {
  name: string;
  enforce: 'post';
  config(config: { root?: string }): { root: string };
};

type ResolvedConfig = {
  root: string;
  resolve: { alias: readonly ImportAlias[] };
};

/** Resolved by the project's own Vite, so aliases that plugins add (SvelteKit's `$lib`) count. */
export const viteConfig: BundlerConfig = {
  name: 'vite',
  files: configFileNames('vite.config'),
  async read(file, context) {
    const vite = await context.load<Vite>('vite');
    if (!vite) return { error: 'vite is not installed in the project' };

    const config = await resolveConfig(vite, file);
    const aliases = config.resolve.alias.map(({ find, replacement }) => ({
      find,
      replacement,
    }));

    return { aliases, rootDirectory: config.root };
  },
};

async function resolveConfig(
  vite: Vite,
  file: string
): Promise<ResolvedConfig> {
  // Vite sets NODE_ENV when it resolves a config.
  const nodeEnv = process.env.NODE_ENV;

  try {
    return await vite.resolveConfig(
      { configFile: file, plugins: [rootPlugin(file)], logLevel: 'silent' },
      'build'
    );
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
}

/**
 * Makes the root what it is when Vite runs in the config's directory: the
 * `root` the config or one of its plugins sets, else that directory. An inline
 * `root` would replace the config's own.
 */
function rootPlugin(configFile: string): ConfigPlugin {
  const directory = path.dirname(configFile);

  return {
    name: 'paraglide-context:root',
    enforce: 'post',
    config: (config) => ({ root: path.resolve(directory, config.root ?? '') }),
  };
}
