"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLocaleFiles = resolveLocaleFiles;
exports.resolveGlobFiles = resolveGlobFiles;
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
    var _a, _b, _c;
    const result = {};
    // Replace [locale] with locale in all paths
    result.json = (_a = files.json) === null || _a === void 0 ? void 0 : _a.map((filepath) => filepath.replace(/\[locale\]/g, locale));
    // Replace [locale] with locale in all paths
    result.md = (_b = files.md) === null || _b === void 0 ? void 0 : _b.map((filepath) => filepath.replace(/\[locale\]/g, locale));
    // Replace [locale] with locale in all paths
    result.mdx = (_c = files.mdx) === null || _c === void 0 ? void 0 : _c.map((filepath) => filepath.replace(/\[locale\]/g, locale));
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
function resolveGlobFiles(files) {
    var _a, _b, _c;
    // Initialize result object with empty arrays for each file type
    const result = {};
    // Process JSON files
    if ((_a = files.json) === null || _a === void 0 ? void 0 : _a.include) {
        if (files.json.include.length > 1) {
            console.error('Only one JSON file is supported at the moment.');
            process.exit(1);
        }
        if (files.json.include.length === 1) {
            const jsonPaths = expandGlobPatterns([files.json.include[0]]);
            if (jsonPaths.length > 1) {
                console.error('JSON glob pattern matched multiple files. Only one JSON file is supported.');
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
    if ((_b = files.md) === null || _b === void 0 ? void 0 : _b.include) {
        result.md = expandGlobPatterns(files.md.include);
    }
    // Process MDX files
    if ((_c = files.mdx) === null || _c === void 0 ? void 0 : _c.include) {
        result.mdx = expandGlobPatterns(files.mdx.include);
    }
    return result;
}
// Helper function to expand glob patterns
function expandGlobPatterns(patterns) {
    // Expand glob patterns to include all matching files
    const expandedPaths = [];
    for (const pattern of patterns) {
        // Check if the pattern contains glob characters
        if (pattern.includes('*') ||
            pattern.includes('?') ||
            pattern.includes('{')) {
            // Resolve the absolute pattern path
            const absolutePattern = path_1.default.resolve(process.cwd(), pattern);
            // Use fast-glob to find all matching files
            const matches = fast_glob_1.default.sync(absolutePattern, { absolute: true });
            expandedPaths.push(...matches);
        }
        else {
            // If it's not a glob pattern, just add the resolved path
            expandedPaths.push(path_1.default.resolve(process.cwd(), pattern));
        }
    }
    return expandedPaths;
}
