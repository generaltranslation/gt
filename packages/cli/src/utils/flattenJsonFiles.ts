import { createFileMapping } from '../formats/files/fileMapping.js';
import fs from 'node:fs';
import { stringifyJson } from '../fs/stringifyJson.js';
import { Settings } from '../types/index.js';
import { batchProcess, FILE_IO_CONCURRENCY } from './batchProcess.js';

export default async function flattenJsonFiles(
  settings: Settings,
  includeFiles?: Set<string>
) {
  if (
    !settings.files ||
    (Object.keys(settings.files.placeholderPaths).length === 1 &&
      settings.files.placeholderPaths.gt)
  ) {
    return;
  }
  const { resolvedPaths: sourceFiles } = settings.files;

  const fileMapping = createFileMapping(
    sourceFiles,
    settings.files.placeholderPaths,
    settings.files.transformPaths,
    settings.files.transformFormats,
    settings.locales,
    settings.defaultLocale
  );

  // One locale at a time so the concurrency bound covers the whole pass
  for (const filesMap of Object.values(fileMapping)) {
    const targetFiles = Object.values(filesMap).filter(
      (p) => p.endsWith('.json') && (!includeFiles || includeFiles.has(p))
    );

    await batchProcess(
      targetFiles,
      async (file) => {
        // Read each json file
        const content = fs.readFileSync(file, 'utf8');
        const json = JSON.parse(content);
        // Flatten the json
        const flattenedJson = flattenJson(json);

        // Write the flattened json to the target file
        await fs.promises.writeFile(
          file,
          stringifyJson(flattenedJson, content)
        );
        return flattenedJson;
      },
      FILE_IO_CONCURRENCY
    );
  }
}

function flattenJson(json: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value, newKey));
    } else {
      result[newKey] = value;
    }
  }

  return result;
}
