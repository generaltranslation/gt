import micromatch from 'micromatch';
import path from 'path';
import JSONPointer from 'jsonpointer';
import { AdditionalOptions } from '../../types/index.js';

const { isMatch } = micromatch;

export function mergeJson(
  translatedContent: string,
  originalContent: string,
  filePath: string,
  options: AdditionalOptions
): string {
  const originalJson = JSON.parse(originalContent);
  const translatedJson = JSON.parse(translatedContent);

  if (!options.jsonSchema) {
    return JSON.stringify(translatedJson, null, 2);
  }

  const fileGlobs = Object.keys(options.jsonSchema);
  const matchingGlob = fileGlobs.find((fileGlob) =>
    isMatch(path.relative(process.cwd(), filePath), fileGlob)
  );

  if (!matchingGlob || !options.jsonSchema[matchingGlob]) {
    return JSON.stringify(translatedJson, null, 2);
  }

  const jsonSchema = options.jsonSchema[matchingGlob];
  if (!jsonSchema?.include) {
    return JSON.stringify(translatedJson, null, 2);
  }

  // Create a deep copy of the original JSON to avoid mutations
  const mergedJson = structuredClone(originalJson);

  for (const [jsonPointer, translatedValue] of Object.entries(translatedJson)) {
    try {
      JSONPointer.set(mergedJson, jsonPointer, translatedValue);
    } catch (error) {}
  }
  return JSON.stringify(mergedJson, null, 2);
}
