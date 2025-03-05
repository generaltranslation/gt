/**
 * Waits for translations to be deployed to the General Translation API
 * @param apiKey - The API key for the General Translation API
 * @param baseUrl - The base URL for the General Translation API
 * @param versionId - The version ID of the project
 * @param locales - The locales to wait for
 * @param startTime - The start time of the wait
 * @param timeoutDuration - The timeout duration for the wait
 * @returns True if all translations are deployed, false otherwise
 */
export declare const waitForUpdates: (apiKey: string, baseUrl: string, versionId: string, locales: string[], startTime: number, timeoutDuration: number) => Promise<boolean>;
