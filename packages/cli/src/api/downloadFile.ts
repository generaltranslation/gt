import * as fs from 'fs';
import * as path from 'path';

// Helper function to download a file
export async function downloadFile(
  baseUrl: string,
  apiKey: string,
  fileId: string,
  outputPath: string
) {
  try {
    const downloadResponse = await fetch(
      `${baseUrl}/v1/project/translations/files/${fileId}/download`,
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
    return false;
  } catch (error) {
    console.error('Error downloading file:', error);
    return false;
  }
}
