import * as fs from 'fs';
import * as path from 'path';
import { logError, logWarning } from '../console/logging.js';
import { gt } from '../utils/gt.js';

/**
 * Downloads multiple translation files in a single batch request
 * @param files - Array of files to download with their output paths
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Object containing successful and failed file IDs
 */
export async function downloadFileBatch(
  baseUrl: string,
  projectId: string,
  apiKey: string,
  files: Array<{
    translationId: string;
    outputPath: string;
  }>,
  maxRetries = 3,
  retryDelay = 1000
): Promise<{ successful: string[]; failed: string[] }> {
  let retries = 0;
  const fileIds = files.map((file) => file.translationId);
  const result = { successful: [] as string[], failed: [] as string[] };

  // Create a map of translationId to outputPath for easier lookup
  const outputPathMap = new Map(
    files.map((file) => [file.translationId, file.outputPath])
  );

  while (retries <= maxRetries) {
    try {
      // Download the files
      const responseData = await gt.downloadFileBatch(fileIds);
      const downloadedFiles = responseData.files || [];

      // Process each file in the response
      for (const file of downloadedFiles) {
        try {
          const translationId = file.id;
          const outputPath = outputPathMap.get(translationId);

          if (!outputPath) {
            logWarning(`No output path found for file: ${translationId}`);
            result.failed.push(translationId);
            continue;
          }

          // Ensure the directory exists
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Write the file to disk
          await fs.promises.writeFile(outputPath, file.data);

          result.successful.push(translationId);
        } catch (error) {
          logError(`Error saving file ${file.id}: ` + error);
          result.failed.push(file.id);
        }
      }

      // Add any files that weren't in the response to the failed list
      const downloadedIds = new Set(
        downloadedFiles.map((file: any) => file.id)
      );
      for (const fileId of fileIds) {
        if (!downloadedIds.has(fileId) && !result.failed.includes(fileId)) {
          result.failed.push(fileId);
        }
      }

      return result;

      // // If we get here, the response was not OK
      // if (retries >= maxRetries) {
      //   logError(
      //     `Failed to download files in batch. Status: ${response.status} after ${maxRetries + 1} attempts.`
      //   );
      //   // Mark all files as failed
      //   result.failed = [...fileIds];
      //   return result;
      // }

      // // Increment retry counter and wait before next attempt
      // retries++;
      // await new Promise((resolve) => setTimeout(resolve, retryDelay));
    } catch (error) {
      // If we've retried too many times, log an error and return false
      if (retries >= maxRetries) {
        logError(
          `Error downloading files in batch after ${maxRetries + 1} attempts: ` +
            error
        );
        // Mark all files as failed
        result.failed = [...fileIds];
        return result;
      }

      // Increment retry counter and wait before next attempt
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  // Mark all files as failed if we get here
  result.failed = [...fileIds];
  return result;
}
