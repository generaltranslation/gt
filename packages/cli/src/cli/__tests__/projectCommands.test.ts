import { Command } from 'commander';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../../types/index.js';

vi.mock('../../config/generateSettings.js', () => ({
  generateSettings: vi.fn(),
}));

vi.mock('../../utils/api.js', () => ({
  api: {
    checkJobStatus: vi.fn(),
    createProject: vi.fn(),
  },
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
    setQuiet: vi.fn(),
  },
}));

import { BaseCLI } from '../base.js';
import { generateSettings } from '../../config/generateSettings.js';
import { api } from '../../utils/api.js';

const settings = {
  apiKey: 'gtx-api-key',
  projectId: 'project-id',
} as Settings;

function createProgram(): Command {
  const program = new Command();
  new BaseCLI(program, 'base');
  program.exitOverride();
  return program;
}

describe('project commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateSettings).mockResolvedValue(settings);
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
        ['project', 'create', '--name', 'Project', '--default-locale', 'en'],
        { from: 'user' }
      )
    ).rejects.toThrow(/Failed to create the project[\s\S]*upstream denied/);
  });

  it('formats project status failures instead of leaking a rejection', async () => {
    vi.mocked(api.checkJobStatus).mockRejectedValue(
      new Error('status unavailable')
    );

    await expect(
      createProgram().parseAsync(['project', 'status', 'job-id'], {
        from: 'user',
      })
    ).rejects.toThrow(
      /Failed to check the project setup status[\s\S]*status unavailable/
    );
  });
});
