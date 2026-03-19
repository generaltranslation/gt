import { describe, it, expect } from 'vitest';
import {
  shouldPublishFile,
  shouldPublishGt,
  hasPublishConfig,
} from '../resolvePublish.js';
import { Settings } from '../../types/index.js';

function createSettings(
  overrides: {
    publish?: boolean;
    publishPaths?: Set<string>;
    unpublishPaths?: Set<string>;
    gtJsonPublish?: boolean;
  } = {}
): Settings {
  return {
    publish: overrides.publish ?? false,
    files: {
      resolvedPaths: {},
      placeholderPaths: {},
      transformPaths: {},
      publishPaths: overrides.publishPaths ?? new Set(),
      unpublishPaths: overrides.unpublishPaths ?? new Set(),
      gtJson: {
        publish: overrides.gtJsonPublish,
      },
    },
  } as Settings;
}

describe('shouldPublishFile', () => {
  it('returns false when file is in unpublishPaths, even if global is true', () => {
    const settings = createSettings({
      publish: true,
      unpublishPaths: new Set(['/abs/internal.json']),
    });
    expect(shouldPublishFile('/abs/internal.json', settings)).toBe(false);
  });

  it('returns true when file is in publishPaths, even if global is false', () => {
    const settings = createSettings({
      publish: false,
      publishPaths: new Set(['/abs/marketing.json']),
    });
    expect(shouldPublishFile('/abs/marketing.json', settings)).toBe(true);
  });

  it('unpublishPaths takes priority over publishPaths', () => {
    const settings = createSettings({
      publishPaths: new Set(['/abs/file.json']),
      unpublishPaths: new Set(['/abs/file.json']),
    });
    expect(shouldPublishFile('/abs/file.json', settings)).toBe(false);
  });

  it('falls back to global publish when file is in neither set', () => {
    const settingsOn = createSettings({ publish: true });
    const settingsOff = createSettings({ publish: false });
    expect(shouldPublishFile('/abs/file.json', settingsOn)).toBe(true);
    expect(shouldPublishFile('/abs/file.json', settingsOff)).toBe(false);
  });

  it('returns false when no config at all', () => {
    const settings = createSettings();
    expect(shouldPublishFile('/abs/file.json', settings)).toBe(false);
  });
});

describe('shouldPublishGt', () => {
  it('returns false when gtJson.publish is explicitly false', () => {
    const settings = createSettings({
      publish: true,
      gtJsonPublish: false,
    });
    expect(shouldPublishGt(settings)).toBe(false);
  });

  it('returns true when gtJson.publish is explicitly true', () => {
    const settings = createSettings({
      publish: false,
      gtJsonPublish: true,
    });
    expect(shouldPublishGt(settings)).toBe(true);
  });

  it('falls back to global publish when gtJson.publish is undefined', () => {
    const settingsOn = createSettings({ publish: true });
    const settingsOff = createSettings({ publish: false });
    expect(shouldPublishGt(settingsOn)).toBe(true);
    expect(shouldPublishGt(settingsOff)).toBe(false);
  });
});

describe('hasPublishConfig', () => {
  it('returns false when no publish config exists', () => {
    const settings = createSettings();
    expect(hasPublishConfig(settings)).toBe(false);
  });

  it('returns true when global publish is true', () => {
    const settings = createSettings({ publish: true });
    expect(hasPublishConfig(settings)).toBe(true);
  });

  it('returns true when gtJson.publish is explicitly set to true', () => {
    const settings = createSettings({ gtJsonPublish: true });
    expect(hasPublishConfig(settings)).toBe(true);
  });

  it('returns true when gtJson.publish is explicitly set to false', () => {
    const settings = createSettings({ gtJsonPublish: false });
    expect(hasPublishConfig(settings)).toBe(true);
  });

  it('returns true when publishPaths has entries', () => {
    const settings = createSettings({
      publishPaths: new Set(['/abs/file.json']),
    });
    expect(hasPublishConfig(settings)).toBe(true);
  });

  it('returns true when unpublishPaths has entries', () => {
    const settings = createSettings({
      unpublishPaths: new Set(['/abs/file.json']),
    });
    expect(hasPublishConfig(settings)).toBe(true);
  });
});
