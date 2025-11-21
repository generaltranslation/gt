import { AdditionalOptions } from '../../types/index.js';
import { exitSync } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import YAML from 'yaml';
import { validateYamlSchema } from './utils.js';
import { flattenJsonWithStringFilter } from '../json/flattenJson.js';

export default function parseYaml(
  content: string,
  filePath: string,
  options: AdditionalOptions
): { content: string; fileFormat: 'JSON' | 'YAML' } {
  const yamlSchema = validateYamlSchema(options, filePath);
  if (!yamlSchema) {
    return { content, fileFormat: 'YAML' };
  }

  let yaml: any;
  try {
    yaml = YAML.parse(content);
  } catch {
    logger.error(`Invalid YAML file: ${filePath}`);
    return exitSync(1);
  }

  if (yamlSchema.include) {
    const flattenedYaml = flattenJsonWithStringFilter(yaml, yamlSchema.include);
    return { content: JSON.stringify(flattenedYaml), fileFormat: 'JSON' };
  }

  return { content, fileFormat: 'YAML' };
}
