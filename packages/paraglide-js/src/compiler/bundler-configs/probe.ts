import fs from 'node:fs';
import path from 'node:path';
import type {
  BundlerConfig,
  ConfigContext,
  ImportResolution,
} from './bundler-config.js';

export type ProbedConfig =
  | { type: 'none' }
  | { type: 'read'; file: string; resolution: ImportResolution }
  | { type: 'unreadable'; file: string; reason: string };

type ConfigFile = { bundler: BundlerConfig; file: string };

/** Reads the first config file that exists: by directory, then by bundler. */
export async function probeBundlerConfig(
  directories: readonly string[],
  bundlers: readonly BundlerConfig[],
  context: ConfigContext
): Promise<ProbedConfig> {
  const found = configFiles(directories, bundlers).find(({ file }) =>
    fs.existsSync(file)
  );
  if (!found) return { type: 'none' };

  const { bundler, file } = found;
  const result = await bundler
    .read(file, context)
    .catch((error: Error) => ({ error: error.message }));
  if ('error' in result) {
    return { type: 'unreadable', file, reason: result.error };
  }

  return { type: 'read', file, resolution: result };
}

function configFiles(
  directories: readonly string[],
  bundlers: readonly BundlerConfig[]
): ConfigFile[] {
  return directories.flatMap((directory) =>
    bundlers.flatMap((bundler) =>
      bundler.files.map((name) => ({
        bundler,
        file: path.join(directory, name),
      }))
    )
  );
}
