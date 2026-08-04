import { OrganizationRequestConfig } from '../types';
import { apiRequest } from '../translate/utils/apiRequest';

export type CreateProjectResult = {
  project: {
    id: string;
    name: string;
    orgId: string;
    defaultLocale: string;
  };
};

/**
 * @internal
 * Creates a project in the organization associated with an organization API key.
 * @param name - The project name.
 * @param defaultLocale - The project's default locale.
 * @param config - The organization-scoped request configuration.
 * @returns The created project.
 */
export async function _createProject(
  name: string,
  defaultLocale: string,
  config: OrganizationRequestConfig
): Promise<CreateProjectResult> {
  return apiRequest<CreateProjectResult>(config, '/v2/projects', {
    body: { name, defaultLocale },
  });
}
