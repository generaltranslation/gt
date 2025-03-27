/**
 * Downloads multiple translation files in a single batch request
 * @param baseUrl - The base URL for the General Translation API
 * @param apiKey - The API key for the General Translation API
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
export declare function downloadFileBatch(baseUrl: string, apiKey: string, files: Array<{
    translationId: string;
    outputPath: string;
}>, maxRetries?: number, retryDelay?: number): Promise<{
    successful: string[];
    failed: string[];
}>;
