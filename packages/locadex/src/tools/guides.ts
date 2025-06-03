import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import getGuide from '../utils/getGuide.js';

type Guide = {
  name: string;
  description: string;
  path: string;
};

export function addGuidesTools(server: McpServer) {
  const guides: Guide[] = [
    {
      name: 'How to internationalize client-side components',
      description:
        'This tool will provide you with a guide on how to internationalize client-side components.',
      path: 'guides/client-side-components.md',
    },
    {
      name: 'How to internationalize server-side components',
      description:
        'This tool will provide you with a guide on how to internationalize server-side components.',
      path: 'guides/server-side-components.md',
    },
    {
      name: 'How to internationalize variables outside of a function scope for client side components only',
      description:
        'This tool will provide you with a guide that is useful for wherever you see a `const` or `let` declaration outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are ONLY used or imported by client side components.',
      path: 'guides/var-outside-client-component.md',
    },
    {
      name: 'How to internationalize variables outside of a function scope for server side components only',
      description:
        'This tool will provide you with a guide that is useful for wherever you see a `const` or `let` declaration outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are ONLY used or importedby server side components.',
      path: 'guides/var-outside-server-component.md',
    },
    {
      name: 'How to internationalize variables outside of a function scope for client side and server side',
      description:
        'This tool will provide you with a guide that is useful for wherever you see a `const` or `let` declaration outside of a function scope that needs to be internationalized. This guide is specifically for when these variables are used or imported by both client side and server side components.',
      path: 'guides/var-outside-client-server-component.md',
    },
  ];

  guides.forEach((guide) => {
    server.tool(guide.name, guide.description, {}, async () => {
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
