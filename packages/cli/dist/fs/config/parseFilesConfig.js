"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocaleFiles = resolveLocaleFiles;
exports.resolveFiles = resolveFiles;
const path_1 = __importDefault(require("path"));
const fast_glob_1 = __importDefault(require("fast-glob"));
/**
 * Resolves the files from the files object
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @param locale - The locale to replace [locale] with
 * @returns The resolved files
 */
function resolveLocaleFiles(files, locale) {
    var _a, _b, _c, _d;
    const result = {};
    // Replace [locale] with locale in all paths
    result.json = (_a = files.json) === null || _a === void 0 ? void 0 : _a.map((filepath) => filepath.replace(/\[locale\]/g, locale));
    // Replace [locale] with locale in all paths
    result.md = (_b = files.md) === null || _b === void 0 ? void 0 : _b.map((filepath) => filepath.replace(/\[locale\]/g, locale));
    // Replace [locale] with locale in all paths
    result.mdx = (_c = files.mdx) === null || _c === void 0 ? void 0 : _c.map((filepath) => filepath.replace(/\[locale\]/g, locale));
    // Replace [locale] with locale in all paths
    result.gt = (_d = files.gt) === null || _d === void 0 ? void 0 : _d.replace(/\[locale\]/g, locale);
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
function resolveFiles(files, locale) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    // Initialize result object with empty arrays for each file type
    const result = {};
    const placeholderResult = {};
    const transformPaths = {};
    // Process GT files
    if ((_a = files.gt) === null || _a === void 0 ? void 0 : _a.output) {
        placeholderResult.gt = files.gt.output;
    }
    // Process JSON files
    if ((_b = files.json) === null || _b === void 0 ? void 0 : _b.include) {
        const jsonPaths = expandGlobPatterns(files.json.include, ((_c = files.json) === null || _c === void 0 ? void 0 : _c.exclude) || [], locale);
        result.json = jsonPaths.resolvedPaths;
        placeholderResult.json = jsonPaths.placeholderPaths;
    }
    // Process MD files
    if ((_d = files.md) === null || _d === void 0 ? void 0 : _d.include) {
        const mdPaths = expandGlobPatterns(files.md.include, ((_e = files.md) === null || _e === void 0 ? void 0 : _e.exclude) || [], locale);
        result.md = mdPaths.resolvedPaths;
        placeholderResult.md = mdPaths.placeholderPaths;
    }
    // Process MDX files
    if ((_f = files.mdx) === null || _f === void 0 ? void 0 : _f.include) {
        const mdxPaths = expandGlobPatterns(files.mdx.include, ((_g = files.mdx) === null || _g === void 0 ? void 0 : _g.exclude) || [], locale);
        result.mdx = mdxPaths.resolvedPaths;
        placeholderResult.mdx = mdxPaths.placeholderPaths;
    }
    // ==== TRANSFORMS ==== //
    if (((_h = files.mdx) === null || _h === void 0 ? void 0 : _h.transform) && !Array.isArray(files.mdx.transform)) {
        transformPaths.mdx = files.mdx.transform;
    }
    if (((_j = files.md) === null || _j === void 0 ? void 0 : _j.transform) && !Array.isArray(files.md.transform)) {
        transformPaths.md = files.md.transform;
    }
    return {
        resolvedPaths: result,
        placeholderPaths: placeholderResult,
        transformPaths: transformPaths,
    };
}
// Helper function to expand glob patterns
function expandGlobPatterns(includePatterns, excludePatterns, locale) {
    // Expand glob patterns to include all matching files
    const resolvedPaths = [];
    const placeholderPaths = [];
    // Process include patterns
    for (const pattern of includePatterns) {
        // Track positions where [locale] appears in the original pattern
        const localePositions = [];
        let searchIndex = 0;
        const localeTag = '[locale]';
        while (true) {
            const foundIndex = pattern.indexOf(localeTag, searchIndex);
            if (foundIndex === -1)
                break;
            localePositions.push(foundIndex);
            searchIndex = foundIndex + localeTag.length;
        }
        const expandedPattern = pattern.replace(/\[locale\]/g, locale);
        // Check if the pattern contains glob characters
        if (expandedPattern.includes('*') ||
            expandedPattern.includes('?') ||
            expandedPattern.includes('{')) {
            // Resolve the absolute pattern path
            const absolutePattern = path_1.default.resolve(process.cwd(), expandedPattern);
            // Prepare exclude patterns with locale replaced
            const expandedExcludePatterns = excludePatterns.map((p) => path_1.default.resolve(process.cwd(), p.replace(/\[locale\]/g, locale)));
            // Use fast-glob to find all matching files, excluding the patterns
            const matches = fast_glob_1.default.sync(absolutePattern, {
                absolute: true,
                ignore: expandedExcludePatterns,
            });
            resolvedPaths.push(...matches);
            // For each match, create a version with [locale] in the correct positions
            matches.forEach((match) => {
                // Convert to relative path to make replacement easier
                const relativePath = path_1.default.relative(process.cwd(), match);
                let originalRelativePath = relativePath;
                // Replace locale with [locale] at each tracked position
                if (localePositions.length > 0) {
                    // We need to account for path resolution differences
                    // This is a simplified approach - we'll replace all instances of the locale
                    // but only in path segments where we expect it based on the original pattern
                    const pathParts = relativePath.split(path_1.default.sep);
                    const patternParts = pattern.split(/[\/\\]/); // Handle both slash types
                    for (let i = 0; i < pathParts.length; i++) {
                        if (i < patternParts.length) {
                            if (patternParts[i].includes(localeTag)) {
                                // This segment should have the locale replaced
                                pathParts[i] = pathParts[i].replace(locale, localeTag);
                            }
                        }
                    }
                    originalRelativePath = pathParts.join(path_1.default.sep);
                }
                // Convert back to absolute path
                const originalPath = path_1.default.resolve(process.cwd(), originalRelativePath);
                placeholderPaths.push(originalPath);
            });
        }
        else {
            // If it's not a glob pattern, just add the resolved path if it's not excluded
            const absolutePath = path_1.default.resolve(process.cwd(), expandedPattern);
            // Check if this path should be excluded
            const expandedExcludePatterns = excludePatterns.map((p) => path_1.default.resolve(process.cwd(), p.replace(/\[locale\]/g, locale)));
            // Only include if not matched by any exclude pattern
            const shouldExclude = expandedExcludePatterns.some((excludePattern) => {
                if (excludePattern.includes('*') ||
                    excludePattern.includes('?') ||
                    excludePattern.includes('{')) {
                    return fast_glob_1.default
                        .sync(excludePattern, { absolute: true })
                        .includes(absolutePath);
                }
                return absolutePath === excludePattern;
            });
            if (!shouldExclude) {
                resolvedPaths.push(absolutePath);
                // For non-glob patterns, we can directly replace locale with [locale]
                // at the tracked positions in the resolved path
                let originalPath = path_1.default.resolve(process.cwd(), pattern);
                placeholderPaths.push(originalPath);
            }
        }
    }
    return { resolvedPaths, placeholderPaths };
}
