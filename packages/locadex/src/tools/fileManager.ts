import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { z } from 'zod';
import { FILE_LIST_PATH } from '../utils/getFiles.js';

interface FileEntry {
  path: string;
  addedAt: string;
  status: 'pending' | 'in_progress' | 'completed';
}

function getFileList(): FileEntry[] {
  if (!existsSync(FILE_LIST_PATH)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(FILE_LIST_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveFileList(files: FileEntry[]): void {
  writeFileSync(FILE_LIST_PATH, JSON.stringify(files, null, 2));
}

export function addFileManagerTools(server: McpServer) {
  server.tool(
    'addFile',
    'Add a file to the internationalization checklist',
    {
      filePath: z
        .string()
        .describe('Path to the file that needs to be internationalized'),
      status: z
        .enum(['pending', 'in_progress', 'completed'])
        .optional()
        .default('pending')
        .describe('Status of the file (default: pending)'),
    },
    async ({ filePath, status = 'pending' }) => {
      const files = getFileList();
      const existingIndex = files.findIndex((f) => f.path === filePath);

      if (existingIndex >= 0) {
        const oldStatus = files[existingIndex].status;
        files[existingIndex].status = status;
        files[existingIndex].addedAt = new Date().toISOString();
      } else {
        files.push({
          path: filePath,
          addedAt: new Date().toISOString(),
          status,
        });
      }

      saveFileList(files);

      return {
        content: [
          {
            type: 'text',
            text: `File "${filePath}" added to internationalization checklist with status: ${status}`,
          },
        ],
      };
    }
  );

  server.tool(
    'removeFile',
    'Remove a file from the internationalization checklist',
    {
      filePath: z
        .string()
        .describe('Path to the file to remove from the checklist'),
    },
    async ({ filePath }) => {
      const files = getFileList();
      const filteredFiles = files.filter((f) => f.path !== filePath);

      if (files.length === filteredFiles.length) {
        return {
          content: [
            {
              type: 'text',
              text: `File "${filePath}" was not found in the checklist`,
            },
          ],
        };
      }

      saveFileList(filteredFiles);

      return {
        content: [
          {
            type: 'text',
            text: `File "${filePath}" removed from internationalization checklist`,
          },
        ],
      };
    }
  );

  server.tool(
    'listFiles',
    'List all files in the internationalization checklist',
    {
      status: z
        .enum(['pending', 'in_progress', 'completed'])
        .optional()
        .describe('Filter by status (optional)'),
    },
    async ({ status }) => {
      let files = getFileList();

      if (status) {
        files = files.filter((f) => f.status === status);
      }

      if (files.length === 0) {
        const filterText = status ? ` with status "${status}"` : '';
        return {
          content: [
            {
              type: 'text',
              text: `No files found in internationalization checklist${filterText}`,
            },
          ],
        };
      }

      const fileList = files
        .map((f) => `- ${f.path} (${f.status}) - Added: ${f.addedAt}`)
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Internationalization file checklist:\n${fileList}`,
          },
        ],
      };
    }
  );

  server.tool(
    'clearFiles',
    'Clear all files from the internationalization checklist by deleting the file',
    {},
    async () => {
      const files = getFileList();
      const fileCount = files.length;

      if (existsSync(FILE_LIST_PATH)) {
        unlinkSync(FILE_LIST_PATH);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Deleted internationalization checklist file (contained ${fileCount} files)`,
          },
        ],
      };
    }
  );
}
