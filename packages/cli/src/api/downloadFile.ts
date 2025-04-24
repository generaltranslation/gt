import * as fs from 'fs';
import * as path from 'path';
import { logError } from '../console/console';

// Helper function to download a file
export async function downloadFile(
  baseUrl: string,
  apiKey: string,
  translationId: string,
  outputPath: string,
  maxRetries = 3,
  retryDelay = 1000
) {
  let retries = 0;

  while (retries <= maxRetries) {
    try {
      const downloadResponse = await fetch(
        `${baseUrl}/v1/project/translations/files/${translationId}/download`,
        {
          method: 'GET',
          headers: {
            ...(apiKey && { 'x-gt-api-key': apiKey }),
          },
        }
      );

      if (downloadResponse.ok) {
        // Ensure the directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Get the file data as an ArrayBuffer
        const fileData = await downloadResponse.arrayBuffer();

        // Write the file to disk
        fs.writeFileSync(outputPath, Buffer.from(fileData));

        return true;
      }

      // If we get here, the response was not OK
      if (retries >= maxRetries) {
        logError(
          `Failed to download file ${outputPath}. Status: ${downloadResponse.status} after ${maxRetries + 1} attempts.`
        );
        return false;
      }

      // Increment retry counter and wait before next attempt
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    } catch (error) {
      if (retries >= maxRetries) {
        logError(
          `Error downloading file ${outputPath} after ${maxRetries + 1} attempts: ` +
            error
        );
        return false;
      }

      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  return false;
}
