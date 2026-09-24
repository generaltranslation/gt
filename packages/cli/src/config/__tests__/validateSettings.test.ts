import { describe, expect, it, vi } from 'vitest';
import { createMockSettings } from '../../api/__mocks__/settings.js';
import { logErrorAndExit } from '../../console/logging.js';
import { validateSettings } from '../validateSettings.js';

vi.mock('../../console/logging.js', () => ({
  logErrorAndExit: vi.fn((message: string) => {
    throw new Error(message);
  }),
}));

describe('validateSettings', () => {
  it('rejects unsupported model providers before making API requests', () => {
    expect(() =>
      validateSettings({
        ...createMockSettings(),
        modelProvider: 'CUSTOM_PROVIDER',
      })
    ).toThrow('The configured model provider is not supported');

    expect(logErrorAndExit).toHaveBeenCalledWith(
      expect.stringContaining('ANTHROPIC, OPENAI, XAI, GOOGLE')
    );
  });
});
