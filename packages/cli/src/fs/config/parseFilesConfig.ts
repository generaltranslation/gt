import path from 'node:path';
import {
  FilesOptions,
  IncludePattern,
  ResolvedFiles,
  Settings,
  TransformFormats,
  TransformFiles,
  TransformOption,
} from '../../types/index.js';
import fg from 'fast-glob';
import { SUPPORTED_FILE_EXTENSIONS } from '../../formats/files/supportedFiles.js';
import { logger } from '../../console/logger.js';
import chalk from 'chalk';
import micromatch from 'micromatch';
import { ParseFlagsByFileType } from '../../types/parsing.js';
import {
  BASE_PARSING_FLAGS_DEFAULT,
  GT_PARSING_FLAGS_DEFAULT,
} from '../../config/defaults.js';
import { resolveTransformationFormat } from '../../formats/files/transformFormat.js';

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

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    result[fileType] = files[fileType]?.map((filepath) =>
      filepath.replace(/\[locale\]/g, locale)
    );
  }

  // Replace [locale] with locale in all paths
  result.gt = files.gt?.replace(/\[locale\]/g, locale);

  return result;
}
/**
 * Normalizes include patterns into plain path strings and tracks which
 * patterns have explicit publish flags.
 */
export function normalizeIncludePatterns(patterns: IncludePattern[]): {
  paths: string[];
  publishPatterns: string[];
  unpublishPatterns: string[];
} {
  const paths: string[] = [];
  const publishPatterns: string[] = [];
  const unpublishPatterns: string[] = [];

  for (const pattern of patterns) {
    if (typeof pattern === 'string') {
      paths.push(pattern);
    } else {
      paths.push(pattern.pattern);
      if (pattern.publish === true) {
        publishPatterns.push(pattern.pattern);
      } else if (pattern.publish === false) {
        unpublishPatterns.push(pattern.pattern);
      }
    }
  }

  return { paths, publishPatterns, unpublishPatterns };
}

/**
 * Resolves the files from the files object.
 * Performs glob pattern expansion on the files.
 * Replaces [locale] with the actual locale in the files.
 *
 * @param files - The files object
 * @returns The resolved files
 */
export function resolveFiles(
  files: FilesOptions,
  locale: string,
  locales: string[],
  cwd: string,
  compositePatterns?: string[]
): Settings['files'] {
  // Initialize result object with empty arrays for each file type
  const resolvedPaths: ResolvedFiles = {};
  const placeholderResult: ResolvedFiles = {};
  const transformPaths: TransformFiles = {};
  // Output format transforms are tracked separately from path transforms.
  const transformFormats: TransformFormats = {};
  const publishPaths = new Set<string>();
  const unpublishPaths = new Set<string>();
  const parsingFlags: ParseFlagsByFileType = {};

  // Process GT files
  if (files.gt?.output) {
    placeholderResult.gt = path.resolve(cwd, files.gt.output);
  }

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    // ==== TRANSFORMS ==== //
    const transform = files[fileType]?.transform;
    if (
      transform &&
      (typeof transform === 'string' ||
        typeof transform === 'object' ||
        Array.isArray(transform))
    ) {
      transformPaths[fileType] = transform;
    }
    // Validate source -> output format transforms during settings generation.
    const transformFormat = resolveTransformationFormat(
      fileType,
      files[fileType]?.transformationFormat
    );
    if (transformFormat) {
      transformFormats[fileType] = transformFormat;
    }
    // ==== PLACEHOLDERS ==== //
    if (files[fileType]?.include) {
      const { paths, publishPatterns, unpublishPatterns } =
        normalizeIncludePatterns(files[fileType].include);

      const filePaths = expandGlobPatterns(
        cwd,
        paths,
        files[fileType]?.exclude || [],
        locale,
        locales,
        transformPaths[fileType] || undefined,
        compositePatterns
      );
      resolvedPaths[fileType] = filePaths.resolvedPaths;
      placeholderResult[fileType] = filePaths.placeholderPaths;

      // Classify resolved paths into publish/unpublish sets
      classifyPublishPaths(
        filePaths.resolvedPaths,
        publishPatterns,
        unpublishPatterns,
        cwd,
        locale,
        publishPaths,
        unpublishPaths
      );
    }
    // ==== OTHER ==== //
    if (files[fileType]?.parsingFlags) {
      parsingFlags[fileType] = {
        ...BASE_PARSING_FLAGS_DEFAULT,
        ...files[fileType].parsingFlags,
      };
    }
  }

  return {
    resolvedPaths,
    placeholderPaths: placeholderResult,
    transformPaths: transformPaths,
    transformFormats,
    publishPaths,
    unpublishPaths,
    parsingFlags,
    gtJson: (() => {
      const rawGtFlags = (files.gt?.parsingFlags || {}) as Record<
        string,
        unknown
      >;
      if ('autoDerive' in rawGtFlags && !('autoderive' in rawGtFlags)) {
        rawGtFlags.autoderive = rawGtFlags.autoDerive;
        delete rawGtFlags.autoDerive;
      }
      return {
        publish: files.gt?.publish,
        parsingFlags: {
          ...GT_PARSING_FLAGS_DEFAULT,
          ...rawGtFlags,
        },
      };
    })(),
  };
}

// Helper function to expand glob patterns
export function expandGlobPatterns(
  cwd: string,
  includePatterns: string[],
  excludePatterns: string[],
  locale: string,
  locales: string[],
  transformPatterns?: TransformOption | string | TransformOption[],
  compositePatterns?: string[]
): {
  resolvedPaths: string[];
  placeholderPaths: string[];
} {
  // Expand glob patterns to include all matching files
  const resolvedPaths: string[] = [];
  const placeholderPaths: string[] = [];

  // Process include patterns
  for (const pattern of includePatterns) {
    // Track positions where [locale] appears in the original pattern
    // It must be included in the pattern, otherwise the CLI tool will not be able to find the correct output path
    // Warn if it's not included
    // Ignore if is composite pattern
    if (
      !pattern.includes('[locale]') &&
      !transformPatterns &&
      !compositePatterns?.includes(pattern)
    ) {
      logger.warn(
        chalk.yellow(
          `Pattern "${pattern}" does not include [locale], so the CLI tool may incorrectly save translated files.`
        )
      );
    }
    const localePositions: number[] = [];
    let searchIndex = 0;
    const localeTag = '[locale]';

    while (true) {
      const foundIndex = pattern.indexOf(localeTag, searchIndex);
      if (foundIndex === -1) break;
      localePositions.push(foundIndex);
      searchIndex = foundIndex + localeTag.length;
    }

    const expandedPattern = pattern.replace(/\[locale\]/g, locale);

    // Resolve the absolute pattern path
    const absolutePattern = path.resolve(cwd, expandedPattern);

    // Prepare exclude patterns with locale replaced
    const expandedExcludePatterns = Array.from(
      new Set(
        excludePatterns.flatMap((p) =>
          locales.map((targetLocale) =>
            path.resolve(
              cwd,
              p
                .replace(/\[locale\]/g, locale)
                .replace(/\[locales\]/g, targetLocale)
            )
          )
        )
      )
    );

    // Use fast-glob to find all matching files, excluding the patterns
    const matches = fg.sync(absolutePattern, {
      absolute: true,
      ignore: expandedExcludePatterns,
    });

    resolvedPaths.push(...matches);

    // For each match, create a version with [locale] in the correct positions
    matches.forEach((match) => {
      const absolutePath = path.resolve(cwd, match);
      const patternPath = path.resolve(cwd, pattern);
      let originalAbsolutePath = absolutePath;

      if (localePositions.length > 0) {
        const placeholderPath = buildPlaceholderPathFromPattern(
          patternPath,
          absolutePath,
          localeTag
        );
        originalAbsolutePath = placeholderPath;
      }

      placeholderPaths.push(originalAbsolutePath);
    });
  }

  return { resolvedPaths, placeholderPaths };
}

function buildPlaceholderPathFromPattern(
  patternPath: string,
  absolutePath: string,
  localeTag: string
): string {
  if (!patternPath.includes(localeTag)) {
    return absolutePath;
  }

  const posixPattern = toPosixPath(patternPath);
  const posixPath = toPosixPath(absolutePath);

  const baseRegex = micromatch.makeRe(posixPattern, {
    literalBrackets: true,
  });
  const localeRegexSource = baseRegex.source.replace(
    /\\\[locale\\\]/g,
    '([^/]+)'
  );
  const flags = baseRegex.flags.includes('d')
    ? baseRegex.flags
    : `${baseRegex.flags}d`;
  const matcher = new RegExp(localeRegexSource, flags);
  const match = matcher.exec(posixPath);

  const matchWithIndices = match as RegExpExecArray & {
    indices?: Array<[number, number]>;
  };

  if (!match || !matchWithIndices.indices) {
    return absolutePath;
  }

  let placeholderPosixPath = posixPath;
  const indices = matchWithIndices.indices;

  for (let i = indices.length - 1; i >= 1; i--) {
    const [start, end] = indices[i];
    if (start === -1 || end === -1) continue;
    placeholderPosixPath =
      placeholderPosixPath.slice(0, start) +
      localeTag +
      placeholderPosixPath.slice(end);
  }

  return path.normalize(placeholderPosixPath);
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

/**
 * Classifies resolved file paths into publish/unpublish sets by matching
 * them against the given glob patterns. Uses POSIX paths for micromatch
 * compatibility but stores platform-native paths in the output sets.
 */
function classifyPublishPaths(
  resolvedPaths: string[],
  publishPatterns: string[],
  unpublishPatterns: string[],
  cwd: string,
  locale: string,
  publishPaths: Set<string>,
  unpublishPaths: Set<string>
): void {
  if (publishPatterns.length === 0 && unpublishPatterns.length === 0) return;

  const posixPaths = resolvedPaths.map(toPosixPath);
  const toAbsoluteGlob = (p: string) =>
    toPosixPath(path.resolve(cwd, p.replace(/\[locale\]/g, locale)));

  for (const pattern of publishPatterns) {
    const matched = new Set(micromatch(posixPaths, toAbsoluteGlob(pattern)));
    for (let i = 0; i < posixPaths.length; i++) {
      if (matched.has(posixPaths[i])) {
        publishPaths.add(resolvedPaths[i]);
      }
    }
  }

  for (const pattern of unpublishPatterns) {
    const matched = new Set(micromatch(posixPaths, toAbsoluteGlob(pattern)));
    for (let i = 0; i < posixPaths.length; i++) {
      if (matched.has(posixPaths[i])) {
        unpublishPaths.add(resolvedPaths[i]);
      }
    }
  }
}
