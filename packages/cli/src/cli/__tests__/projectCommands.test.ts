import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));

const api = vi.hoisted(() => ({
  queryJobs: vi.fn(),
  createProject: vi.fn(),
}));
vi.mock('generaltranslation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('generaltranslation')>()),
  GT: (await import('./forwardingGT.js')).forwardingGT(api),
}));

vi.mock('../../console/logging.js', () => ({
  displayHeader: vi.fn(),
  exitSync: vi.fn((code: number) => {
    throw new Error(`exit ${code}`);
  }),
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
  promptConfirm: vi.fn(),
  promptGlobPatterns: vi.fn(),
  promptMultiSelect: vi.fn(),
  promptSelect: vi.fn(),
  promptText: vi.fn(),
}));

vi.mock('../../console/logger.js', () => ({
  logger: {
    endCommand: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    setConsoleOutput: vi.fn(),
    setQuiet: vi.fn(),
  },
}));

import { BaseCLI } from '../base.js';
import { generateSettings } from '../../config/generateSettings.js';
import { logger } from '../../console/logger.js';

const settings = {
  apiKey: 'gtx-api-key',
  projectId: 'project-id',
} as Settings;

function createProgram(): Command {
  const program = new Command().exitOverride();
  new BaseCLI(program, 'base');
  return program;
}

describe('project commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateSettings).mockResolvedValue(settings);
  });

  it('creates a project in the requested organization without a project ID', async () => {
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-organization-key',
    } as Settings);
    vi.mocked(api.createProject).mockResolvedValue({
      project: {
        id: 'new-project-id',
        name: 'Project',
        orgId: 'org-id',
        defaultLocale: 'en',
      },
    });

    await createProgram().parseAsync(
      [
        'project',
        'create',
        '--org-id',
        'org-id',
        '--name',
        'Project',
        '--default-locale',
        'en',
        '--cdn-enabled',
      ],
      { from: 'user' }
    );

    expect(api.createProject).toHaveBeenCalledWith('org-id', {
      name: 'Project',
      defaultLocale: 'en',
      cdnEnabled: true,
    });
    expect(logger.info).toHaveBeenCalledWith(
      'Created Project (new-project-id)'
    );
  });

  it('requires an organization ID before creating a project', async () => {
    const program = createProgram();
    program.configureOutput({ writeErr: vi.fn() });

    await expect(
      program.parseAsync(
        ['project', 'create', '--name', 'Project', '--default-locale', 'en'],
        { from: 'user' }
      )
    ).rejects.toThrow("required option '--org-id <orgId>' not specified");
    expect(generateSettings).not.toHaveBeenCalled();
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('explains that a project API key cannot create projects before any request', async () => {
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-api-project-key',
    } as Settings);

    await expect(
      createProgram().parseAsync(
        [
          'project',
          'create',
          '--org-id',
          'org-id',
          '--name',
          'Project',
          '--default-locale',
          'en',
        ],
        { from: 'user' }
      )
    ).rejects.toThrow(
      /project API key, which cannot create projects[\s\S]*Organization API key with org:projects:create[\s\S]*sign in/
    );
    expect(api.createProject).not.toHaveBeenCalled();
  });

  it('formats project creation failures instead of leaking a rejection', async () => {
    // Organization keys create the project before a project ID exists.
    vi.mocked(generateSettings).mockResolvedValue({
      apiKey: 'gtx-organization-key',
    } as Settings);
    vi.mocked(api.createProject).mockRejectedValue(
      new Error('upstream denied')
    );

    await expect(
      createProgram().parseAsync(
        [
          'project',
          'create',
          '--org-id',
          'org-id',
          '--name',
          'Project',
          '--default-locale',
          'en',
        ],
        { from: 'user' }
      )
    ).rejects.toThrow(/Failed to create the project[\s\S]*upstream denied/);
  });

  it.each(['processing', 'not_found'] as const)(
    'prints the %s status of a project setup job',
    async (status) => {
      vi.mocked(api.queryJobs).mockResolvedValue({
        results: [{ id: 'job-id', status }],
      });

      await createProgram().parseAsync(['project', 'status', 'job-id'], {
        from: 'user',
      });

      expect(api.queryJobs).toHaveBeenCalledWith(['job-id']);
      expect(logger.info).toHaveBeenCalledWith(status);
    }
  );

  it('formats project status failures instead of leaking a rejection', async () => {
    vi.mocked(api.queryJobs).mockRejectedValue(new Error('status unavailable'));

    await expect(
      createProgram().parseAsync(['project', 'status', 'job-id'], {
        from: 'user',
      })
    ).rejects.toThrow(
      /Failed to check the project setup status[\s\S]*status unavailable/
    );
  });
});
