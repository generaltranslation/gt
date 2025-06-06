import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getGuide from '../getGuide.js';

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
    id: 'basic_next-setup',
    description: 'Basic guide for setting up gt-next in a Next.js project.',
    path: 'guides/next/basic/setup.md',
    type: 'basic',
  },
  {
    id: 'basic_next-jsx',
    description:
      'Basic guide for translating JSX and HTML content in a Next.js project.',
    path: 'guides/next/basic/jsx.md',
    type: 'basic',
  },
  {
    id: 'basic_next-branches',
    description:
      'Basic guide for using branch components and dealing with conditional JSX in a Next.js project.',
    path: 'guides/next/basic/branches.md',
    type: 'basic',
  },
  {
    id: 'basic_next-variables',
    description:
      'Basic guide for using internationalizing variable content (Currency, DateTime, Numbers, and other dynamic content) in a Next.js project.',
    path: 'guides/next/basic/variables.md',
    type: 'basic',
  },
  {
    id: 'basic_next-client-side-components',
    description:
      'Basic guide on how to internationalize client-side components.',
    path: 'guides/next/basic/client-side-components.md',
    type: 'basic',
  },
  {
    id: 'basic_next-server-side-components',
    description:
      'Basic guide on how to internationalize server-side components.',
    path: 'guides/next/basic/server-side-components.md',
    type: 'basic',
  },
  {
    id: 'basic_next-locale-selector',
    description:
      'Basic guide on how to add a locale selector to your application.',
    path: 'guides/next/basic/locale-selector.md',
    type: 'basic',
  },
  {
    id: 'basic_next-translating-html',
    description:
      'Basic guide on how to translate HTML and JSX content in a Next.js project.',
    path: 'guides/next/basic/translating-html.md',
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
    id: 'advanced_nex-outside-server-component',
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
