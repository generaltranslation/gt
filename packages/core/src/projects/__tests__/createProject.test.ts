import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _createProject, CreateProjectResult } from '../createProject';
import { apiRequest } from '../../translate/utils/apiRequest';
import { OrganizationRequestConfig } from '../../types';

vi.mock('../../translate/utils/apiRequest');

describe('_createProject', () => {
  const config: OrganizationRequestConfig = {
    baseUrl: 'https://api.test.com',
    apiKey: 'gtx-org-test-key',
  };
  const createProjectResult: CreateProjectResult = {
    project: {
      id: 'project-123',
      name: 'Customer Portal',
      orgId: 'org-123',
      defaultLocale: 'en-US',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a project with the requested name and default locale', async () => {
    vi.mocked(apiRequest).mockResolvedValue(createProjectResult);

    const result = await _createProject('Customer Portal', 'en-US', config);

    expect(apiRequest).toHaveBeenCalledWith(config, '/v2/projects', {
      body: {
        name: 'Customer Portal',
        defaultLocale: 'en-US',
      },
      retryPolicy: 'none',
    });
    expect(result).toEqual(createProjectResult);
  });

  it('should propagate API errors', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('API error'));

    await expect(
      _createProject('Customer Portal', 'en-US', config)
    ).rejects.toThrow('API error');
  });
});
