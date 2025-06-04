import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchDocContent, getDocs } from '../utils/getDocs.js';

export function addDocsTools(server: McpServer) {
  server.tool(
    'fetch-docs',
    'Fetches the content of a specific documentation file by its path.',
    {
      path: z
        .string()
        .describe(
          'The path to the documentation file (e.g., "platform/index.mdx" or "react/introduction.mdx")'
        ),
    },
    async ({ path }) => {
      try {
        const content = await getDocs(path);

        if (!content) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to fetch documentation for path: ${path}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching documentation: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    'list-docs',
    'Lists available documentation files in the format of an llms.txt file. This is a list of all the documentation files available to you.',
    {},
    async () => {
      try {
        const content = await fetchDocContent('llms.txt');

        if (!content) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to fetch documentation index`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error listing documentation: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
