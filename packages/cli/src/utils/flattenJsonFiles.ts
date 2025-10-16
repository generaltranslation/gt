import { createFileMapping } from '../formats/files/fileMapping.js';
import fs from 'node:fs';
import { Settings } from '../types/index.js';

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
    settings.locales,
    settings.defaultLocale
  );

  await Promise.all(
    Object.values(fileMapping).map(async (filesMap) => {
      const targetFiles = Object.values(filesMap).filter(
        (p) => p.endsWith('.json') && (!includeFiles || includeFiles.has(p))
      );

      await Promise.all(
        targetFiles.map(async (file) => {
          // Read each json file
          const json = JSON.parse(fs.readFileSync(file, 'utf8'));
          // Flatten the json
          const flattenedJson = flattenJson(json);

          // Write the flattened json to the target file
          await fs.promises.writeFile(
            file,
            JSON.stringify(flattenedJson, null, 2)
          );
          return flattenedJson;
        })
      );
    })
  );
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
