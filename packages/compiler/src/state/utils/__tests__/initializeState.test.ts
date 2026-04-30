import { describe, expect, it } from 'vitest';
import { initializeState } from '../initializeState';

describe('initializeState', () => {
  it('disables cross-file resolution by default', () => {
    const state = initializeState({}, 'test.tsx');

    expect(state.settings.enableCrossFileResolution).toBe(false);
  });

  it('enables cross-file resolution from plugin options', () => {
    const state = initializeState(
      { enableCrossFileResolution: true },
      'test.tsx'
    );

    expect(state.settings.enableCrossFileResolution).toBe(true);
  });

  it('enables cross-file resolution from gtConfig parsing flags', () => {
    const state = initializeState(
      {
        gtConfig: {
          files: {
            gt: {
              parsingFlags: {
                enableCrossFileResolution: true,
              },
            },
          },
        },
      },
      'test.tsx'
    );

    expect(state.settings.enableCrossFileResolution).toBe(true);
  });

  it('lets plugin options override gtConfig parsing flags', () => {
    const state = initializeState(
      {
        enableCrossFileResolution: false,
        gtConfig: {
          files: {
            gt: {
              parsingFlags: {
                enableCrossFileResolution: true,
              },
            },
          },
        },
      },
      'test.tsx'
    );

    expect(state.settings.enableCrossFileResolution).toBe(false);
  });
});
