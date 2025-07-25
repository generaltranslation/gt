import path from 'node:path';
import fs from 'node:fs';
import { Settings } from '../types/index.js';
import { TranslateOptions } from '../cli/base.js';
import { logError } from '../console/logging.js';

/**
 * Copy a file to target locale without translation
 *
 * This is a naive approach, does not allow for wild cards
 */
export default async function copyFile(settings: Settings & TranslateOptions) {
  if (!settings.options?.copyFiles || settings.options.copyFiles.length === 0) {
    return;
  }

  // Construct a map of source paths to target paths
  const copyFiles = settings.options.copyFiles.reduce(
    (paths: Record<string, string[]>, filePathTemplate: string) => {
      const sourcePath = path.join(
        process.cwd(),
        filePathTemplate.replace('[locale]', settings.defaultLocale)
      );
      if (!fs.existsSync(sourcePath)) {
        logError(
          `Failed to copy files: File path does not exist: ${sourcePath}`
        );
        return paths;
      }
      paths[sourcePath] = [];
      for (const locale of settings.locales) {
        if (locale === settings.defaultLocale) continue;
        const targetPath = path.join(
          process.cwd(),
          filePathTemplate.replace('[locale]', locale)
        );
        paths[sourcePath].push(targetPath);
      }
      return paths;
    },
    {} as Record<string, string[]>
  );

  // Copy each file to the target locale
  for (const sourcePath in copyFiles) {
    for (const targetPath of copyFiles[sourcePath]) {
      // Ensure the target directory exists
      const targetDir = path.dirname(targetPath);
      await fs.promises.mkdir(targetDir, { recursive: true });

      // Copy the file
      await fs.promises.copyFile(sourcePath, targetPath);
    }
  }
}
