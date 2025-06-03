import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getGuide from '../utils/getGuide.js';

type Guide = {
  id: string;
  description: string;
  path: string;
};

export const guides: Guide[] = [
  {
    id: 'guide-i18n-client-side-components',
    description:
      'This tool will provide you with a guide on how to internationalize client-side components.',
    path: 'guides/next/basic/client-side-components.md',
  },
  {
    id: 'guide-i18n-server-side-components',
    description:
      'This tool will provide you with a guide on how to internationalize server-side components.',
    path: 'guides/next/basic/server-side-components.md',
  },
  {
    id: 'guide-i18n-var-outside-client-component',
    description:
      'This tool will provide you with a guide that is useful for wherever you see a `const` or `let` declaration outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are ONLY used or imported by client side components.',
    path: 'guides/next/advanced/var-outside-client-component.md',
  },
  {
    id: 'guide-i18n-var-outside-server-component',
    description:
      'This tool will provide you with a guide that is useful for wherever you see a `const` or `let` declaration outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are ONLY used or importedby server side components.',
    path: 'guides/next/advanced/var-outside-server-component.md',
  },
  {
    id: 'guide-i18n-var-outside-client-server-component',
    description:
      'This tool will provide you with a guide that is useful for wherever you see a `const` or `let` declaration outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are used or imported by both client side and server side components.',
    path: 'guides/next/advanced/var-outside-client-server-component.md',
  },
  {
    id: 'guide-i18n-ternary-operators',
    description:
      'This tool will provide you with a guide that is useful for wherever you see a ternary operator or conditional statements that needs to be internationalized.',
    path: 'guides/next/advanced/ternary-operators.md',
  },
  {
    id: 'guide-i18n-complicated-mapping-expressions',
    description:
      'This tool will provide you with a guide that is useful for wherever you see a mapping expression that needs to be internationalized.',
    path: 'guides/next/advanced/complicated-mapping-expressions.md',
  },
  {
    id: 'guide-i18n-interpolated-strings',
    description:
      'This tool will provide you with a guide that is useful for wherever you see an interpolated string that needs to be internationalized.',
    path: 'guides/next/advanced/interpolated-strings.md',
  },
  {
    id: 'guide-i18n-setup-nextjs',
    description:
      'This tool will provide you with a guide for setting up gt-next in a Next.js project.',
    path: 'guides/next/basic/setup.mdx',
  },
  {
    id: 'guide-i18n-jsx-nextjs',
    description:
      'This tool will provide you with a guide for translating JSX content in a Next.js project.',
    path: 'guides/next/basic/jsx.mdx',
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
