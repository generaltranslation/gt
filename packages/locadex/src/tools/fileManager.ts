import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { z } from 'zod';

export const fileManagerTools: { [id: string]: string } = {
  addFile: 'Add a file to the internationalization checklist',
  markFileAsPending:
    'Mark a file as pending internationalization in the internationalization checklist',
  markFileAsInProgress:
    'Mark a file as in progress in the internationalization checklist',
  markFileAsEdited:
    'Mark a file as edited in the internationalization checklist',
  removeFile: 'Remove a file from the internationalization checklist',
  listFiles: 'List all files in the internationalization checklist',
  clearFiles:
    'Clear all files from the internationalization checklist by deleting the file',
};

interface FileEntry {
  path: string;
  addedAt: string;
  status: 'pending' | 'in_progress' | 'edited';
}

function getFileList(stateFilePath: string): FileEntry[] {
  if (!stateFilePath || !existsSync(stateFilePath)) {
    return [];
  }
  try {
    return JSON.parse(readFileSync(stateFilePath, 'utf8'));
  } catch {
    return [];
  }
}

function saveFileList(files: FileEntry[], stateFilePath: string): void {
  writeFileSync(stateFilePath, JSON.stringify(files, null, 2));
}

export function addFileManagerTools(server: McpServer, stateFilePath: string) {
  server.tool(
    'addFile',
    fileManagerTools['addFile'],
    {
      filePath: z
        .string()
        .describe('Path to the file that needs to be internationalized'),
      status: z
        .enum(['pending', 'in_progress', 'edited'])
        .optional()
        .default('pending')
        .describe('Status of the file (default: pending)'),
    },
    async ({ filePath, status = 'pending' }) => {
      const files = getFileList(stateFilePath);
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

      saveFileList(files, stateFilePath);

      return {
        content: [
          {
            type: 'text',
            text: `File has been added to internationalization checklist successfully. Ensure that you continue to use the internationalization checklist to track your progress. Please proceed with the current tasks if applicable`,
          },
        ],
      };
    }
  );

  server.tool(
    'markFileAsPending',
    fileManagerTools['markFileAsPending'],
    {
      filePath: z.string().describe('Path to the file to mark as pending'),
    },
    async ({ filePath }) => {
      const files = getFileList(stateFilePath);
      let foundFile = false;
      const updatedFiles = files.map((f) => {
        if (f.path === filePath) {
          foundFile = true;
          return { ...f, status: 'pending' } as FileEntry;
        }
        return f;
      });

      if (!foundFile) {
        return {
          content: [
            {
              type: 'text',
              text: `File "${filePath}" was not found in the checklist.`,
            },
          ],
        };
      }

      saveFileList(updatedFiles, stateFilePath);

      return {
        content: [
          {
            type: 'text',
            text: `File "${filePath}" has been marked as pending in the internationalization checklist successfully. Ensure that you continue to use the internationalization checklist to track your progress. Please proceed with the current tasks if applicable`,
          },
        ],
      };
    }
  );

  server.tool(
    'markFileAsInProgress',
    fileManagerTools['markFileAsInProgress'],
    {
      filePath: z.string().describe('Path to the file to mark as in progress'),
    },
    async ({ filePath }) => {
      const files = getFileList(stateFilePath);
      let foundFile = false;
      const updatedFiles = files.map((f) => {
        if (f.path === filePath) {
          foundFile = true;
          return { ...f, status: 'in_progress' } as FileEntry;
        }
        return f;
      });

      if (!foundFile) {
        return {
          content: [
            {
              type: 'text',
              text: `File "${filePath}" was not found in the checklist.`,
            },
          ],
        };
      }

      saveFileList(updatedFiles, stateFilePath);

      return {
        content: [
          {
            type: 'text',
            text: `File "${filePath}" has been marked as in progress in the internationalization checklist successfully. Ensure that you continue to use the internationalization checklist to track your progress. Please proceed with the current tasks if applicable`,
          },
        ],
      };
    }
  );

  server.tool(
    'markFileAsEdited',
    fileManagerTools['markFileAsEdited'],
    {
      filePath: z.string().describe('Path to the file to mark as edited'),
    },
    async ({ filePath }) => {
      const files = getFileList(stateFilePath);
      let foundFile = false;
      const updatedFiles = files.map((f) => {
        if (f.path === filePath) {
          foundFile = true;
          return { ...f, status: 'edited' } as FileEntry;
        }
        return f;
      });

      if (!foundFile) {
        return {
          content: [
            {
              type: 'text',
              text: `File "${filePath}" was not found in the checklist.`,
            },
          ],
        };
      }

      saveFileList(updatedFiles, stateFilePath);

      return {
        content: [
          {
            type: 'text',
            text: `File "${filePath}" has been marked as edited in the internationalization checklist successfully. Ensure that you continue to use the internationalization checklist to track your progress. Please proceed with the current tasks if applicable`,
          },
        ],
      };
    }
  );

  server.tool(
    'listFiles',
    fileManagerTools['listFiles'],
    {
      status: z
        .enum(['pending', 'in_progress', 'edited'])
        .optional()
        .describe('Filter by status (optional)'),
    },
    async ({ status }) => {
      let files = getFileList(stateFilePath);

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

  server.tool('clearFiles', fileManagerTools['clearFiles'], {}, async () => {
    const files = getFileList(stateFilePath);
    const fileCount = files.length;

    const filePath = stateFilePath;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Deleted internationalization checklist file (contained ${fileCount} files)`,
        },
      ],
    };
  });
}
