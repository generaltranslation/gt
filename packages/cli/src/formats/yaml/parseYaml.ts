import { AdditionalOptions } from '../../types/index.js';
import { exit, logError } from '../../console/logging.js';
import YAML from 'yaml';
import { validateYamlSchema } from './utils.js';
import { flattenJsonWithStringFilter } from '../json/flattenJson.js';

export default function parseYaml(
  content: string,
  filePath: string,
  options: AdditionalOptions
): string {
  const yamlSchema = validateYamlSchema(options, filePath);
  if (!yamlSchema) {
    return content;
  }

  let yaml: any;
  try {
    yaml = YAML.parse(content);
  } catch {
    logError(`Invalid YAML file: ${filePath}`);
    exit(1);
  }

  if (yamlSchema.include) {
    const flattenedYaml = flattenJsonWithStringFilter(yaml, yamlSchema.include);
    return JSON.stringify(flattenedYaml);
  }

  return content;
}
