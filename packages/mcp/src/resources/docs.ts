import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { CACHE_TTL, fetchDocContent } from '../utils/getDocs.js';

export async function addDocsResource(server: McpServer) {
  // Add root resource for MCP docs
  server.resource(
    'mcp-docs',
    new ResourceTemplate('mcp-docs://', {
      list: async () => ({
        resources: [
          {
            name: 'Standard LLM specification',
            uri: 'llms://llms.txt',
          },
          {
            name: 'Full LLM specification',
            uri: 'llms://llms-full.txt',
          },
        ],
      }),
    }),
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: 'MCP Documentation Resources',
        },
      ],
    })
  );

  // Resource for llms-full.txt
  server.resource('llms-full.txt', 'llms://llms-full.txt', async (uri) => {
    try {
      const content = await fetchDocContent('llms-full.txt');

      return {
        contents: [
          {
            uri: uri.href,
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error('Error retrieving llms-full.txt resource:', error);
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: Unable to retrieve llms-full.txt resource. ${error}`,
          },
        ],
      };
    }
  });

  // Resource for llms.txt
  server.resource('llms.txt', 'llms://llms.txt', async (uri) => {
    try {
      const content = await fetchDocContent('llms.txt');

      return {
        contents: [
          {
            uri: uri.href,
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error('Error retrieving llms.txt resource:', error);
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: Unable to retrieve llms.txt resource. ${error}`,
          },
        ],
      };
    }
  });
}

// Start a background job to periodically refresh the cache
export function startCacheRefreshJob() {
  const refreshCache = async () => {
    try {
      console.error('Refreshing MCP resources cache...');
      await fetchDocContent('llms.txt');
      await fetchDocContent('llms-full.txt');
      console.error('Cache refresh complete');
    } catch (error) {
      console.error('Error refreshing cache:', error);
    }
  };

  // Initial fetch
  refreshCache();

  // Set up periodic refresh
  const interval = setInterval(refreshCache, CACHE_TTL);

  // Return cleanup function
  return () => clearInterval(interval);
}
