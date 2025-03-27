import { NextRequest } from 'next/server';
export type PathConfig = {
    [key: string]: string | {
        [key: string]: string;
    };
};
/**
 * Extracts the locale from the given pathname.
 */
export declare function extractLocale(pathname: string): string | null;
/**
 * Extracts dynamic parameters from a path based on a shared path pattern
 */
export declare function extractDynamicParams(templatePath: string, path: string): string[];
/**
 * Replaces dynamic segments in a path with their actual values
 */
export declare function replaceDynamicSegments(path: string, templatePath: string): string;
/**
 * Gets the full localized path given a shared path and locale
 */
export declare function getLocalizedPath(sharedPath: string, locale: string, pathConfig: PathConfig): string | undefined;
/**
 * Creates a map of localized paths to shared paths using regex patterns
 */
export declare function createPathToSharedPathMap(pathConfig: PathConfig, prefixDefaultLocale: boolean, defaultLocale: string): {
    pathToSharedPath: {
        [key: string]: string;
    };
    defaultLocalePaths: string[];
};
/**
 * Gets the shared path from a given pathname, handling both static and dynamic paths
 */
export declare function getSharedPath(pathname: string, pathToSharedPath: {
    [key: string]: string;
}): string | undefined;
/**
 * Gets the locale from the request using various sources
 */
export declare function getLocaleFromRequest(req: NextRequest, defaultLocale: string, approvedLocales: string[], localeRouting: boolean, gtServicesEnabled: boolean, prefixDefaultLocale: boolean, defaultLocalePaths: string[]): {
    userLocale: string;
    pathnameLocale: string | undefined;
    unstandardizedPathnameLocale: string | null | undefined;
    clearResetCookie: boolean;
};
//# sourceMappingURL=utils.d.ts.map