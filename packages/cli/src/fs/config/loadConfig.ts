import fs from 'node:fs';
import * as v from 'valibot';
import {
  describeConfigIssues,
  describeConfigParseError,
} from 'generaltranslation/config-schema';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { GTConfigFileLoadSchema } from '../../config/schema.js';
import { logErrorAndExit } from '../../console/logging.js';

export type GTConfigFile = v.InferOutput<typeof GTConfigFileLoadSchema>;

/** `--config` accepts a path with or without its `.json` extension. */
export function withJsonExtension(configPath: string): string {
  return configPath.endsWith('.json') ? configPath : `${configPath}.json`;
}

/** Validates config content read from, or about to be written to, `filepath`. */
export function parseConfig(config: unknown, filepath: string): GTConfigFile {
  const result = v.safeParse(GTConfigFileLoadSchema, config);
  if (result.success) return result.output;
  return logErrorAndExit(
    createDiagnosticMessage({
      source: 'gt',
      severity: 'Error',
      ...describeConfigIssues(result.issues, filepath),
    })
  );
}

export function loadConfig(filepath: string): GTConfigFile {
  let config: unknown;
  try {
    config = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch (error) {
    return logErrorAndExit(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        ...describeConfigParseError(error, filepath),
      })
    );
  }
  return parseConfig(config, filepath);
}
