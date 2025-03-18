import path from 'path';
import { FilesOptions, ResolvedFiles } from '../../types';
import fg from 'fast-glob';

/**
 * Resolves the files from the files object
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @param locale - The locale to replace [locale] with
 * @returns The resolved files
 */
export function resolveLocaleFiles(
  files: ResolvedFiles,
  locale: string
): ResolvedFiles {
  const result: ResolvedFiles = {};

  // Replace [locale] with locale in all paths
  result.json = files.json?.map((filepath) =>
    filepath.replace(/\[locale\]/g, locale)
  );

  // Replace [locale] with locale in all paths
  result.md = files.md?.map((filepath) =>
    filepath.replace(/\[locale\]/g, locale)
  );

  // Replace [locale] with locale in all paths
  result.mdx = files.mdx?.map((filepath) =>
    filepath.replace(/\[locale\]/g, locale)
  );

  return result;
}
/**
 * Resolves the files from the files object
 * Performs glob pattern expansion on the files
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @returns The resolved files
 */
export function resolveGlobFiles(files: FilesOptions): ResolvedFiles {
  // Initialize result object with empty arrays for each file type
  const result: ResolvedFiles = {};

  // Process JSON files
  if (files.json?.include) {
    if (files.json.include.length > 1) {
      console.error('Only one JSON file is supported at the moment.');
      process.exit(1);
    }

    if (files.json.include.length === 1) {
      const jsonPaths = expandGlobPatterns([files.json.include[0]]);
      if (jsonPaths.length > 1) {
        console.error(
          'JSON glob pattern matched multiple files. Only one JSON file is supported.'
        );
        process.exit(1);
      }
      result.json = jsonPaths;
    }
  }

  // Process YAML files
  // if (files.yaml?.include) {
  //   if (files.yaml.include.length > 1) {
  //     console.error('Only one YAML file is supported at the moment.');
  //     process.exit(1);
  //   }

  //   if (files.yaml.include.length === 1) {
  //     const yamlPaths = expandGlobPatterns(
  //       [files.yaml.include[0]],
  //       locale
  //     );
  //     if (yamlPaths.length > 1) {
  //       console.error(
  //         'YAML glob pattern matched multiple files. Only one YAML file is supported.'
  //       );
  //       process.exit(1);
  //     }
  //     result.yaml = yamlPaths;
  //   }
  // }

  // Process MD files
  if (files.md?.include) {
    result.md = expandGlobPatterns(files.md.include);
  }

  // Process MDX files
  if (files.mdx?.include) {
    result.mdx = expandGlobPatterns(files.mdx.include);
  }

  return result;
}

// Helper function to expand glob patterns
function expandGlobPatterns(patterns: string[]): string[] {
  // Expand glob patterns to include all matching files
  const expandedPaths: string[] = [];
  for (const pattern of patterns) {
    // Check if the pattern contains glob characters
    if (
      pattern.includes('*') ||
      pattern.includes('?') ||
      pattern.includes('{')
    ) {
      // Resolve the absolute pattern path
      const absolutePattern = path.resolve(process.cwd(), pattern);
      // Use fast-glob to find all matching files
      const matches = fg.sync(absolutePattern, { absolute: true });
      expandedPaths.push(...matches);
    } else {
      // If it's not a glob pattern, just add the resolved path
      expandedPaths.push(path.resolve(process.cwd(), pattern));
    }
  }

  return expandedPaths;
}
