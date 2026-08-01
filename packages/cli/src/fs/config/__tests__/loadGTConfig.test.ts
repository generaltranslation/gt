import fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logErrorAndExit } from '../../../console/logging.js';
import { loadConfig } from '../loadConfig.js';
import { loadGTConfig } from '../loadGTConfig.js';

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

vi.mock('../../../console/logging.js', () => ({
  logErrorAndExit: vi.fn(() => {
    throw new Error('exit');
  }),
}));

const mockReadFileSync = vi.mocked(fs.readFileSync);
const mockLogErrorAndExit = vi.mocked(logErrorAndExit);

describe('loadGTConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a valid GT configuration', () => {
    mockReadFileSync.mockReturnValue('{"locales":["fr"]}');

    expect(loadGTConfig('/project/gt.config.json')).toEqual({
      locales: ['fr'],
    });
    expect(mockLogErrorAndExit).not.toHaveBeenCalled();
  });

  it('reports malformed GT configuration and exits', () => {
    mockReadFileSync.mockReturnValue('{"locales": [');

    expect(() => loadGTConfig('/project/gt.config.json')).toThrow('exit');
    expect(mockLogErrorAndExit).toHaveBeenCalledWith(
      expect.stringMatching(
        /gt Error: Could not parse GT configuration at "\/project\/gt\.config\.json" because the file is not valid JSON\..*Fix the JSON syntax.*Details:/
      )
    );
  });

  it('does not change the tolerant generic loader behavior', () => {
    mockReadFileSync.mockReturnValue('{"compilerOptions": [');

    expect(loadConfig('/project/tsconfig.json')).toEqual({});
    expect(mockLogErrorAndExit).not.toHaveBeenCalled();
  });
});
