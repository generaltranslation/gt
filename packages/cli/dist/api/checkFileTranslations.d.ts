/**
 * Checks the status of translations for a given version ID
 * @param apiKey - The API key for the General Translation API
 * @param baseUrl - The base URL for the General Translation API
 * @param versionId - The version ID of the project
 * @param locales - The locales to wait for
 * @param startTime - The start time of the wait
 * @param timeoutDuration - The timeout duration for the wait in seconds
 * @returns True if all translations are deployed, false otherwise
 */
export declare function checkFileTranslations(apiKey: string, baseUrl: string, data: {
    [key: string]: {
        versionId: string;
        fileName: string;
    };
}, locales: string[], timeoutDuration: number, resolveOutputPath: (sourcePath: string, locale: string) => string, downloadStatus: {
    downloaded: Set<string>;
    failed: Set<string>;
}): Promise<boolean>;
