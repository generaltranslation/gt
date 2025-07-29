import { AdditionalOptions, YamlSchema } from '../../types/index.js';
import { logError } from '../../console/logging.js';
import { exit } from '../../console/logging.js';
import micromatch from 'micromatch';
const { isMatch } = micromatch;
import path from 'path';

export function validateYamlSchema(
  options: AdditionalOptions,
  filePath: string
): YamlSchema | null {
  if (!options.yamlSchema) {
    return null;
  }
  // Check if the file matches any of the yaml schema globs
  const fileGlobs = Object.keys(options.yamlSchema);
  const matchingGlob = fileGlobs.find((fileGlob) =>
    isMatch(path.relative(process.cwd(), filePath), fileGlob)
  );
  if (!matchingGlob || !options.yamlSchema[matchingGlob]) {
    return null;
  }

  // Validate includes
  const yamlSchema = options.yamlSchema[matchingGlob];
  if (!yamlSchema.include) {
    logError('No include property found in YAML schema');
    exit(1);
  }
  return yamlSchema;
}
