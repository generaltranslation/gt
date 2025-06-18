import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchDocContent, getDocs } from '../getDocs.js';
import { logger } from '../../logging/logger.js';

export const docsTools: { [id: string]: string } = {
  'fetch-docs':
    'Fetches the content of a specific documentation file by its path.',
  'list-docs':
    'Lists available documentation files in the format of an llms.txt file. This is a list of all the documentation files available to you.',
};

export function addDocsTools(server: McpServer) {
  server.tool(
    'fetch-docs',
    docsTools['fetch-docs'],
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
          logger.log(`[locadex-mcp: fetch-docs] Document not found: ${path}`);
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
        logger.log(
          `[locadex-mcp: fetch-docs] Document fetched successfully: ${path}`
        );

        return {
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        };
      } catch (error) {
        logger.log(
          `[locadex-mcp: fetch-docs] Error fetching documentation: ${error instanceof Error ? error.message : String(error)}`
        );
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

  server.tool('list-docs', docsTools['list-docs'], {}, async () => {
    try {
      const content = await fetchDocContent('llms.txt');

      if (!content) {
        logger.log(
          `[locadex-mcp: list-docs] Failed to fetch documentation index`
        );
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

      logger.log(
        `[locadex-mcp: list-docs] Documentation index fetched successfully`
      );

      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    } catch (error) {
      logger.log(
        `[locadex-mcp: list-docs] Error listing documentation: ${error instanceof Error ? error.message : String(error)}`
      );
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
  });
}
