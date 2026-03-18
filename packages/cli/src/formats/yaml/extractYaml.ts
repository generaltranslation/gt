import { AdditionalOptions } from '../../types/index.js';
import { logger } from '../../console/logger.js';
import { validateYamlSchema } from './utils.js';
import { flattenJsonWithStringFilter } from '../json/flattenJson.js';
import YAML from 'yaml';

/**
 * Extracts translated values from a fully merged YAML file back into the
 * flattened JSON pointer format that mergeYaml expects.
 * This is the inverse of mergeYaml — it takes a merged YAML document and
 * extracts only the values at the schema's include paths.
 *
 * @param localContent - The full YAML content from the user's local file
 * @param inputPath - The path to the file (used for matching yamlSchema)
 * @param options - Additional options containing yamlSchema config
 * @returns The flattened JSON string of translatable values, or null if no extraction needed
 */
export function extractYaml(
  localContent: string,
  inputPath: string,
  options: AdditionalOptions
): string | null {
  const yamlSchema = validateYamlSchema(options, inputPath);
  if (!yamlSchema || !yamlSchema.include) {
    return null;
  }

  let yaml: Record<string, unknown>;
  try {
    yaml = YAML.parse(localContent);
  } catch {
    logger.error(`Invalid YAML file: ${inputPath}`);
    return null;
  }

  const extracted = flattenJsonWithStringFilter(yaml, yamlSchema.include);
  if (!Object.keys(extracted).length) return null;
  return JSON.stringify(extracted);
}
