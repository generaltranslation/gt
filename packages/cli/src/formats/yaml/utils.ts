import { AdditionalOptions, YamlSchema } from '../../types/index.js';
import { exitSync } from '../../console/logging.js';
import { logger } from '../../console/logger.js';
import micromatch from 'micromatch';
const { isMatch } = micromatch;
import path from 'path';
import { toPosixGlob, toPosixPath } from '../../utils/paths.js';

export function validateYamlSchema(
  options: AdditionalOptions,
  filePath: string
): YamlSchema | null {
  if (!options.yamlSchema) {
    return null;
  }
  // Check if the file matches any of the yaml schema globs
  const relativeFilePath = toPosixPath(path.relative(process.cwd(), filePath));
  const fileGlobs = Object.keys(options.yamlSchema);
  const matchingGlob = fileGlobs.find((fileGlob) =>
    isMatch(relativeFilePath, toPosixGlob(fileGlob))
  );
  if (!matchingGlob || !options.yamlSchema[matchingGlob]) {
    return null;
  }

  // Validate includes
  const yamlSchema = options.yamlSchema[matchingGlob];
  if (!yamlSchema.include) {
    logger.error('No include property found in YAML schema');
    return exitSync(1);
  }
  return yamlSchema;
}
