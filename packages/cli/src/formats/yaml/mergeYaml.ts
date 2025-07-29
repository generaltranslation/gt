import JSONPointer from 'jsonpointer';
import { exit, logError } from '../../console/logging.js';
import { AdditionalOptions } from '../../types/index.js';
import { validateYamlSchema } from './utils.js';
import YAML from 'yaml';

export default function mergeYaml(
  originalContent: string,
  inputPath: string,
  options: AdditionalOptions,
  targets: {
    translatedContent: string;
    targetLocale: string;
  }[]
): string[] {
  const yamlSchema = validateYamlSchema(options, inputPath);
  if (!yamlSchema) {
    return targets.map((target) => target.translatedContent);
  }

  let originalYaml: any;
  try {
    originalYaml = YAML.parse(originalContent);
  } catch {
    logError(`Invalid YAML file: ${inputPath}`);
    exit(1);
  }
  // Unreachable (validated in validateYamlSchema, included for type check)
  if (!yamlSchema.include) {
    logError('No include property found in YAML schema');
    exit(1);
  }

  // Handle include
  const output: string[] = [];
  for (const target of targets) {
    // Must clone the original YAML to avoid mutations
    const mergedYaml = JSON.parse(JSON.stringify(originalYaml));

    let translatedJson: Record<string, any>;
    try {
      translatedJson = JSON.parse(target.translatedContent);
    } catch {
      // If parsing fails, treat as empty object to avoid crashes
      translatedJson = {};
    }

    for (const [jsonPointer, translatedValue] of Object.entries(
      translatedJson
    )) {
      try {
        // Try to get the value - if this succeeds, the pointer exists
        if (!JSONPointer.get(mergedYaml, jsonPointer)) {
          continue;
        }
        // Set the new value regardless of what the current value is (including null/falsy)
        JSONPointer.set(mergedYaml, jsonPointer, translatedValue);
      } catch {
        // Silently ignore invalid or non-existent JSON pointers
      }
    }
    output.push(YAML.stringify(mergedYaml));
  }

  return output;
}
