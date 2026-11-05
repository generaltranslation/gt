import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../../../types/index.js';

vi.mock('../../../../console/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { logger } from '../../../../console/logger.js';
import { setupCommand } from '../../../../console/index.js';
import { hasValidCredentials } from '../validation.js';

describe('hasValidCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('points to sign-in and the dashboard when no project ID is found', () => {
    const settings = {
      dashboardUrl: 'https://dash.example.com',
    } as Settings;

    expect(hasValidCredentials(settings)).toBe(false);

    const message = vi.mocked(logger.error).mock.calls[0]?.[0];
    expect(message).toMatch(
      /^gt Error: No project ID was found, and translating needs a General Translation project\. /
    );
    expect(message).toContain(
      '`npx gt init --live-translations` (Vite, React Router or TanStack Start with local storage)'
    );
    expect(message).toContain(
      '`npx gt init --dev-credentials` (CDN storage or other apps)'
    );
    expect(message).toContain(
      'copy your project ID from https://dash.example.com into gt.config.json'
    );
    expect(message).toContain('--project-id');
    expect(message).toContain('GT_PROJECT_ID');
  });

  it('keeps a custom config path in the recovery commands', () => {
    const settings = {
      config: path.join(process.cwd(), '.gt/gt.config.json'),
      dashboardUrl: 'https://dash.example.com',
    } as Settings;

    hasValidCredentials(settings);

    const message = vi.mocked(logger.error).mock.calls[0]?.[0];
    expect(message).toContain(
      '`npx gt init --live-translations --config .gt/gt.config.json`'
    );
    expect(message).toContain(
      '`npx gt init --dev-credentials --config .gt/gt.config.json`'
    );
    expect(message).toContain('into .gt/gt.config.json as projectId');
  });

  it('accepts a configured project ID', () => {
    const settings = { projectId: 'p1' } as Settings;

    expect(hasValidCredentials(settings)).toBe(true);
    expect(logger.error).not.toHaveBeenCalled();
  });
});

describe('setupCommand', () => {
  it('omits the root config, which setup finds on its own', () => {
    expect(setupCommand('--dev-credentials', 'gt.config.json')).toBe(
      'npx gt init --dev-credentials'
    );
    expect(
      setupCommand('--dev-credentials', path.resolve('gt.config.json'))
    ).toBe('npx gt init --dev-credentials');
    expect(setupCommand('--dev-credentials', '')).toBe(
      'npx gt init --dev-credentials'
    );
  });

  it('quotes a config path that the shell would split or expand', () => {
    expect(setupCommand('--dev-credentials', 'my config/$gt.json')).toBe(
      'npx gt init --dev-credentials --config "my config/\\$gt.json"'
    );
  });
});
