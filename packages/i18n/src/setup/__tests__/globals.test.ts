import { describe, expect, it } from 'vitest';
import {
  getGTServicesEnabled,
  setupGTServicesEnabled,
} from '../globals';

describe('gtServicesEnabled globals', () => {
  it('throws before initialization', () => {
    delete globalThis.__generaltranslation?.gtServicesEnabled;

    expect(() => getGTServicesEnabled()).toThrow(
      'Cannot read gtServicesEnabled. GT has not been initialized.'
    );
  });

  it('stores the evaluated gt services flag', () => {
    setupGTServicesEnabled({
      projectId: 'test-project',
      cacheUrl: undefined,
    });
    expect(getGTServicesEnabled()).toBe(true);

    setupGTServicesEnabled({
      cacheUrl: null,
      runtimeUrl: null,
    });
    expect(getGTServicesEnabled()).toBe(false);
  });
});
