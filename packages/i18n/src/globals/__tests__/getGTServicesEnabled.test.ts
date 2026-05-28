import { afterEach, describe, expect, it } from 'vitest';
import {
  getGTServicesEnabled,
  setupGTServicesEnabled,
} from '../getGTServicesEnabled';

describe('getGTServicesEnabled', () => {
  afterEach(() => {
    globalThis.__generaltranslation = undefined;
  });

  it('stores true when GT remote translations are enabled', () => {
    setupGTServicesEnabled({ projectId: 'test-project' });

    expect(getGTServicesEnabled()).toBe(true);
  });

  it('stores true when the GT runtime API is enabled', () => {
    setupGTServicesEnabled({
      projectId: 'test-project',
      devApiKey: 'test-key',
      cacheUrl: null,
    });

    expect(getGTServicesEnabled()).toBe(true);
  });

  it('stores false when GT services are disabled', () => {
    setupGTServicesEnabled({
      cacheUrl: null,
      runtimeUrl: null,
    });

    expect(getGTServicesEnabled()).toBe(false);
  });
});
