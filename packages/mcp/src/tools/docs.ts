import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchDocContent, getDocs } from '../utils/getDocs.js';

export function addDocsTools(server: McpServer) {
  server.tool(
    'fetch-docs',
    {
      description: 'Fetches the content of a documentation file by its path.',
      parameters: {
        path: z
          .string()
          .describe(
            'The path to the documentation file (e.g., "platform/index.mdx" or "react/introduction.mdx")'
          ),
      },
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
    {
      description:
        'Lists available documentation files in the format of an llms.txt or llms-full.txt file. "full" returns the full documentation, "short" returns a summary.',
      parameters: {
        type: z
          .enum(['full', 'short'])
          .default('short')
          .describe(
            'Type of documentation list: "full" for llms-full.txt or "short" for llms.txt'
          ),
      },
    },
    async ({ type }) => {
      try {
        const filename = type === 'full' ? 'llms-full.txt' : 'llms.txt';
        const content = await fetchDocContent(filename);

        if (!content) {
          return {
            content: [
              {
                type: 'text',
                text: `Failed to fetch ${filename} documentation index`,
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
