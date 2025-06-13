import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getGuide from '../getGuide.js';
import { logger } from '../../logging/logger.js';

type Guide = {
  id: string;
  description: string;
  path: string;
  type: 'important' | 'basic' | 'advanced';
};

export const guides: Guide[] = [
  {
    id: 'next_important_functions',
    description:
      'Important documentation outlining the imports available in `gt-next`.',
    path: 'guides/next/important/functions.md',
    type: 'important',
  },
  {
    id: 'next_basic_jsx',
    description:
      'Call this tool when you see content in JSX or HTML that needs to be internationalized.',
    path: 'guides/next/basic/jsx.md',
    type: 'basic',
  },
  {
    id: 'next_basic_strings',
    description: `Call this tool when you see a string created by '', "", or \`\` that needs to be internationalized.`,
    path: 'guides/next/basic/strings.md',
    type: 'basic',
  },
  {
    id: 'next_basic_branches',
    description:
      'Call this tool when you see a conditional statement or a pluralization statement that needs to be internationalized.',
    path: 'guides/next/basic/branches.md',
    type: 'basic',
  },
  {
    id: 'next_basic_variables',
    description:
      'Call this tool when you see variable content (Currency, DateTime, Numbers, and other dynamic content) that needs to be internationalized.',
    path: 'guides/next/basic/variables.md',
    type: 'basic',
  },
  {
    id: 'next_advanced_interpolated-strings',
    description:
      'Call this tool when you see a string with variables within/around it or interpolated string (template string literal with quasis) that needs to be internationalized.',
    path: 'guides/next/advanced/interpolated-strings.md',
    type: 'advanced',
  },
  {
    id: 'next_advanced_conditional-rendering',
    description:
      'Call this tool when you see a conditional statement or a pluralization statement that needs to be internationalized.',
    path: 'guides/next/advanced/conditional-rendering.md',
    type: 'advanced',
  },
  {
    id: 'next_advanced_external-strings',
    description:
      'Call this tool when you see a variable, constant, or function containing strings outside of a component scope that needs to be internationalized.',
    path: 'guides/next/advanced/external-strings.md',
    type: 'advanced',
  },
  {
    id: 'next_advanced_mapping-expressions',
    description:
      'Call this tool when you see a mapping expression for a nested data structure that contains content that needs to be internationalized.',
    path: 'guides/next/advanced/mapping-expressions.md',
    type: 'advanced',
  },
];

export function addGuidesTools(server: McpServer) {
  guides.forEach((guide) => {
    server.tool(guide.id, guide.description, {}, async () => {
      const path = guide.path;
      const { content, error } = await getGuide(path);
      if (error) {
        logger.log(`[locadex-mcp: ${guide.id}] Error fetching guide: ${path}`);
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching guide: ${error}`,
            },
          ],
          isError: true,
        };
      }
      logger.log(
        `[locadex-mcp: ${guide.id}] Guide fetched successfully: ${path}`
      );
      return {
        content: [
          {
            type: 'text',
            text: content ?? '',
          },
        ],
      };
    });
  });
}
