import micromatch from 'micromatch';
import path from 'path';
import { AdditionalOptions } from '../../types/index.js';
import { flattenJsonDictionary } from '../../react/utils/flattenDictionary.js';
const { isMatch } = micromatch;

// Parse a JSON file according to a JSON schema
export function parseJson(
  content: string,
  filePath: string,
  options: AdditionalOptions
): string {
  const json = JSON.parse(content);
  if (!options.jsonSchema) {
    // Validate the JSON is valid -> Only nested objects are allowed, no arrays
    flattenJsonDictionary(json);
    return content;
  }

  const fileGlobs = Object.keys(options.jsonSchema);
  // Only use the first one that matches
  const matchingGlob = fileGlobs.find((fileGlob) =>
    isMatch(path.relative(process.cwd(), filePath), fileGlob)
  );
  if (matchingGlob) {
    const extractedJson = {};
    const jsonSchema = options.jsonSchema[matchingGlob];
    if (jsonSchema) {
    }
    return JSON.stringify(extractedJson);
  } else {
    // Validate the JSON is valid -> Only nested objects are allowed, no arrays
    flattenJsonDictionary(json);
    return content;
  }
}
