import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../../../types/index.js';

vi.mock('../../../../console/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { logger } from '../../../../console/logger.js';
import { hasValidCredentials } from '../validation.js';

describe('hasValidCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('points to the dashboard when no project ID is found', () => {
    const settings = {
      dashboardUrl: 'https://dash.example.com',
    } as Settings;

    expect(hasValidCredentials(settings)).toBe(false);

    expect(vi.mocked(logger.error).mock.calls[0]?.[0]).toBe(
      'gt Error: No project ID was found. Pass --project-id, add projectId to gt.config.json, or set the GT_PROJECT_ID environment variable. Find your project ID, or create a project, in the dashboard (https://dash.example.com)'
    );
  });

  it('accepts a configured project ID', () => {
    const settings = { projectId: 'p1' } as Settings;

    expect(hasValidCredentials(settings)).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
