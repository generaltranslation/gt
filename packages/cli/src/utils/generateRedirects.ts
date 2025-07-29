import fs from 'fs';
import path from 'path';
import { logInfo } from '../console/logging.js';

interface RedirectEntry {
  source: string;
  destination: string;
}

interface DocsJson {
  redirects?: RedirectEntry[];
  [key: string]: any;
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.mdx') || file.endsWith('.md')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

/**
 * Generate redirects for all .mdx files in the /en directory
 * and append them to the existing docs.json file
 */
export default function generateRedirects(
  configPath: string,
  defaultLocale: string
): void {
  const enDir = path.join(process.cwd(), defaultLocale);
  const docsJsonPath = path.join(process.cwd(), configPath);

  // Get all .mdx files in /en directory
  const allFiles = getAllFiles(enDir);

  // Generate redirect entries
  const redirects: RedirectEntry[] = allFiles.map((filePath) => {
    // Get relative path from /en directory
    const relativePath = path.relative(enDir, filePath);
    // Remove .mdx extension
    const pathWithoutExt = relativePath.replace(/\.(mdx|md)$/, '');

    return {
      source: `/${pathWithoutExt}`,
      destination: `/en/${pathWithoutExt}`,
    };
  });

  // Read existing docs.json to filter out existing redirects
  const docsJson: DocsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf8'));
  const existingRedirects = docsJson.redirects || [];

  // Create a Set of existing source paths for fast lookup
  const existingSources = new Set(
    existingRedirects.map((redirect) => redirect.source)
  );

  // Filter out redirects that already exist
  console.log(redirects);
  console.log('redirects length', redirects.length);
  const newRedirects = redirects.filter((redirect) => {
    if (redirect.source.includes('ai-review')) {
      console.log('redirect', redirect);
    }
    return !existingSources.has(redirect.source);
  });
  console.log('newRedirects length', newRedirects.length);
  if (newRedirects.length > 0) {
    // Append new redirects to existing docs.json
    docsJson.redirects = [...existingRedirects, ...newRedirects];

    // Write updated docs.json back to file
    fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2));

    logInfo(`Added ${newRedirects.length} new redirects to ${docsJsonPath}`);
    logInfo(`Total redirects now: ${docsJson.redirects.length}`);
  } else {
    logInfo(
      `No new redirects to add - all paths already exist in ${docsJsonPath}`
    );
  }
}
