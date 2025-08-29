import fs from 'node:fs';
import path from 'node:path';
import { logInfo } from '../console/logging.js';
import chalk from 'chalk';

export async function createLoadTranslationsFile(
  appDirectory: string,
  translationsDir: string = './public/_gt'
) {
  const usingSrcDirectory = fs.existsSync(path.join(appDirectory, 'src'));

  // Calculate the relative path from the loadTranslations.js location to the translations directory
  const loadTranslationsDir = usingSrcDirectory
    ? path.join(appDirectory, 'src')
    : appDirectory;
  const relativePath = path.relative(
    loadTranslationsDir,
    path.resolve(appDirectory, translationsDir)
  );
  const publicPath = relativePath ? `${relativePath}/` : './';

  const filePath = usingSrcDirectory
    ? path.join(appDirectory, 'src', 'loadTranslations.js')
    : path.join(appDirectory, 'loadTranslations.js');

  if (!fs.existsSync(filePath)) {
    const loadTranslationsContent = `
export default async function loadTranslations(locale) {
  try {
    // Load translations from ${translationsDir} directory
    // This matches the GT config files.gt.output path
    const t = await import(\`${publicPath}\${locale}.json\`);
    return t.default;
  } catch (error) {
    console.warn(\`Failed to load translations for locale \${locale}:\`, error);
    return {};
  }
}
`;
    await fs.promises.writeFile(filePath, loadTranslationsContent);
    logInfo(
      `Created ${chalk.cyan(
        'loadTranslations.js'
      )} file at ${chalk.cyan(filePath)}.`
    );
  } else {
    logInfo(
      `Found ${chalk.cyan('loadTranslations.js')} file at ${chalk.cyan(
        filePath
      )}. Skipping creation...`
    );
  }
}
