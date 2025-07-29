import * as fs from 'fs';
import * as path from 'path';
import { logError } from '../console/logging.js';
import { gt } from '../utils/gt.js';
import { Settings } from '../types/index.js';
import { validateJsonSchema } from '../formats/json/utils.js';
import { mergeJson } from '../formats/json/mergeJson.js';
import { TextDecoder } from 'node:util';
import mergeYaml from '../formats/yaml/mergeYaml.js';
import { validateYamlSchema } from '../formats/yaml/utils.js';

/**
 * Downloads a file from the API and saves it to a local directory
 * @param translationId - The ID of the translation to download
 * @param outputPath - The path to save the file to
 * @param maxRetries - The maximum number of retries to attempt
 * @param retryDelay - The delay between retries in milliseconds
 */
export async function downloadFile(
  translationId: string,
  outputPath: string,
  inputPath: string,
  locale: string,
  options: Settings,
  maxRetries = 3,
  retryDelay = 1000
) {
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      // Get the file data as an ArrayBuffer
      const fileData = await gt.downloadFile(translationId);

      // Ensure the directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let data = new TextDecoder().decode(fileData);
      if (options.options?.jsonSchema && locale) {
        const jsonSchema = validateJsonSchema(options.options, outputPath);
        if (jsonSchema) {
          const originalContent = fs.readFileSync(outputPath, 'utf8');
          if (originalContent) {
            data = mergeJson(
              originalContent,
              inputPath,
              options.options,
              [
                {
                  translatedContent: data,
                  targetLocale: locale,
                },
              ],
              options.defaultLocale
            )[0];
          }
        }
      }

      if (options.options?.yamlSchema && locale) {
        const yamlSchema = validateYamlSchema(options.options, outputPath);
        if (yamlSchema) {
          const originalContent = fs.readFileSync(outputPath, 'utf8');
          if (originalContent) {
            data = mergeYaml(originalContent, outputPath, options.options, [
              {
                translatedContent: data,
                targetLocale: locale,
              },
            ])[0];
          }
        }
      }

      // Write the file to disk
      await fs.promises.writeFile(outputPath, data);

      return true;
    } catch (error) {
      // If we've retried too many times, log an error and return false
      if (retries >= maxRetries) {
        logError(
          `Error downloading file ${outputPath} after ${maxRetries + 1} attempts: ` +
            error
        );
        return false;
      }

      // Increment retry counter and wait before next attempt
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return false;
}
