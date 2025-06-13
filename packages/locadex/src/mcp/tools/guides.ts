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
    id: 'important_next-functions',
    description:
      'Important documentation outlining the imports available in `gt-next`.',
    path: 'guides/next/important/functions.md',
    type: 'important',
  },
  {
    id: 'basic_next-jsx',
    description:
      'Call this tool when you see content in JSX or HTML that needs to be internationalized.',
    path: 'guides/next/basic/jsx.md',
    type: 'basic',
  },
  {
    id: 'basic_next-strings',
    description: `Call this tool when you see a string created by '', "", or \`\` that needs to be internationalized.`,
    path: 'guides/next/basic/strings.md',
    type: 'basic',
  },
  {
    id: 'basic_next-branches',
    description:
      'Call this tool when you see a conditional statement or a pluralization statement that needs to be internationalized.',
    path: 'guides/next/basic/branches.md',
    type: 'basic',
  },
  {
    id: 'basic_next-variables',
    description:
      'Call this tool when you see variable content (Currency, DateTime, Numbers, and other dynamic content) that needs to be internationalized.',
    path: 'guides/next/basic/variables.md',
    type: 'basic',
  },
  {
    id: 'advanced_next-outside-client-component',
    description:
      'Advanced guide for wherever you see a `const` or `let` or a function outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are ONLY used or imported by client side components.',
    path: 'guides/next/advanced/var-outside-client-component.md',
    type: 'advanced',
  },
  {
    id: 'advanced_next-outside-server-component',
    description:
      'Advanced guide for wherever you see a `const` or `let` or a function outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are ONLY used or imported by server side components.',
    path: 'guides/next/advanced/var-outside-server-component.md',
    type: 'advanced',
  },
  {
    id: 'advanced_next-outside-client-server-component',
    description:
      'Advanced guide for wherever you see a `const` or `let` or a function outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are used or imported by both client side and server side components.',
    path: 'guides/next/advanced/var-outside-client-server-component.md',
    type: 'advanced',
  },
  {
    id: 'advanced_next-ternary-operators',
    description:
      'Advanced guide for complex scenarios with ternary operators or conditional statements that needs to be internationalized.',
    path: 'guides/next/advanced/ternary-operators.md',
    type: 'advanced',
  },
  {
    id: 'advanced_next-complicated-mapping-expressions',
    description:
      'Advanced guide for wherever you see a mapping expression or mapping expression for a nested data structure that needs to be internationalized.',
    path: 'guides/next/advanced/complicated-mapping-expressions.md',
    type: 'advanced',
  },
  {
    id: 'advanced_next-interpolated-strings',
    description:
      'Advanced guide for wherever you see a string with variables within/around it or interpolated string (template string literal with quasis) that needs to be internationalized.',
    path: 'guides/next/advanced/interpolated-strings.md',
    type: 'advanced',
  },
  {
    id: 'advanced_next-migrating',
    description:
      'Advanced guide for migrating from an existing i18n library such as react-i18next or next-i18next to gt-next.',
    path: 'guides/next/advanced/migrating.md',
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
