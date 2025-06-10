import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { logger } from '../logging/logger.js';
import path from 'node:path';
import { LocadexConfig } from '../types/cli.js';

export function validateInitialConfig() {
  // Validate ANTHROPIC_API_KEY
  if (!process.env.ANTHROPIC_API_KEY) {
    logger.error(
      'ANTHROPIC_API_KEY is not set! Please set it as an environment variable or in a .env | .env.local file.'
    );
    process.exit(1);
  }
}

const CONFIG_FILE_NAME = 'config.json';

export function createConfig(
  directory: string,
  options: {
    batchSize: number;
    maxConcurrency: number;
    matchingFiles: string[];
    matchingExtensions: string[];
  }
) {
  const configPath = path.resolve(directory, CONFIG_FILE_NAME);
  if (existsSync(configPath)) {
    return;
  }

  const config = {
    batchSize: options.batchSize,
    maxConcurrency: options.maxConcurrency,
    matchingFiles: options.matchingFiles,
    matchingExtensions: options.matchingExtensions,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const DEFAULT_CONFIG: LocadexConfig = {
  batchSize: 10,
  maxConcurrency: 1,
  matchingFiles: ['*'],
  matchingExtensions: ['.ts', '.tsx', '.js', '.jsx'],
};

export function getConfig(
  directory: string,
  options: Partial<LocadexConfig> = {}
): LocadexConfig {
  const configPath = path.resolve(directory, CONFIG_FILE_NAME);
  let fileConfig: Partial<LocadexConfig> = {};

  // Load config file if it exists
  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (error) {
      logger.error(
        `Error parsing config file ${configPath}: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue with empty file config on parse error
    }
  }

  // Merge configurations: defaults < file config < passed options
  const mergedConfig = { ...DEFAULT_CONFIG, ...fileConfig, ...options };

  // Use hierarchy for arrays: options > file config > defaults
  mergedConfig.matchingFiles =
    options.matchingFiles && options.matchingFiles.length > 0
      ? options.matchingFiles
      : fileConfig.matchingFiles && fileConfig.matchingFiles.length > 0
        ? fileConfig.matchingFiles
        : DEFAULT_CONFIG.matchingFiles;

  mergedConfig.matchingExtensions =
    options.matchingExtensions && options.matchingExtensions.length > 0
      ? options.matchingExtensions
      : fileConfig.matchingExtensions &&
          fileConfig.matchingExtensions.length > 0
        ? fileConfig.matchingExtensions
        : DEFAULT_CONFIG.matchingExtensions;

  return mergedConfig;
}
