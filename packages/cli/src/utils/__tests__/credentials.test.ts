import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BROWSER_AUTH_UNAVAILABLE_MESSAGE,
  retrieveCredentials,
} from '../credentials.js';
import { logErrorAndExit } from '../../console/logging.js';
import type { Settings } from '../../types/index.js';

vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

describe('retrieveCredentials', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fails with manual credential instructions before making auth requests', async () => {
    await expect(retrieveCredentials({} as Settings, 'all')).rejects.toThrow(
      BROWSER_AUTH_UNAVAILABLE_MESSAGE
    );

    expect(logErrorAndExit).toHaveBeenCalledWith(
      BROWSER_AUTH_UNAVAILABLE_MESSAGE
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
