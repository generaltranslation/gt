import { vi } from 'vitest';

type Forwarded = (...args: never[]) => unknown;

/**
 * A `GT` stand-in for `vi.mock('generaltranslation')`: project and account
 * methods call the matching flat mock, with the project or organization ID
 * as the first argument where the real method is scoped to one.
 */
export function forwardingGT(api: Record<string, Forwarded>) {
  const call = (name: string, ...args: unknown[]) =>
    (api[name] as (...args: unknown[]) => unknown)(...args);
  return vi.fn(function (params: { projectId?: string }) {
    const { projectId } = params;
    if (projectId) {
      return {
        createApiKey: (body: unknown) =>
          call('createProjectApiKey', projectId, body),
        queryJobs: (...args: unknown[]) => call('queryJobs', ...args),
      };
    }
    return {
      listOrgs: () => call('listOrgs'),
      listProjects: () => call('listProjects'),
      org: (orgId: string) => ({
        createProject: (body: unknown) => call('createProject', orgId, body),
      }),
    };
  });
}
