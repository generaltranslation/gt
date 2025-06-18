import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '../../logging/logger.js';
import { execFunction } from '../../utils/exec.js';

export function addValidateProjectTool(
  server: McpServer,
  appDirectory: string
) {
  server.tool(
    'validate-project',
    'Validates a project for internationalization errors',
    {},
    async () => {
      try {
        const { stdout, stderr, code } = await execFunction(
          'locadex',
          ['validate'],
          false,
          appDirectory,
          undefined,
          1 * 60 * 1000 // 1 minute
        );
        if (code === 0) {
          logger.log(
            `[locadex-mcp: validate] Successfully validated project: ${stdout}`
          );
          return {
            content: [{ type: 'text', text: stdout }],
          };
        } else {
          logger.log(
            `[locadex-mcp: validate] Error validating project: ${stdout} with code ${code}`
          );
          return {
            content: [{ type: 'text', text: stdout }],
          };
        }
      } catch (error) {
        logger.log(
          `[locadex-mcp: validate] Error validating project: ${error instanceof Error ? error.message : String(error)}`
        );
        return {
          content: [
            {
              type: 'text',
              text: `Error validating project: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    }
  );
}
