import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const confConstructorMock = vi.hoisted(() =>
  vi.fn(function MockConf(this: { get: () => undefined; set: () => void }) {
    this.get = vi.fn(() => undefined);
    this.set = vi.fn();
  })
);
const existsSyncMock = vi.hoisted(() => vi.fn(() => false));
const readFileSyncMock = vi.hoisted(() => vi.fn(() => ''));

vi.mock('conf', () => ({
  default: confConstructorMock,
}));

vi.mock('fs', () => ({
  default: {
    existsSync: existsSyncMock,
    readFileSync: readFileSyncMock,
  },
}));

describe('telemetry storage', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      CI: process.env.CI,
      GITHUB_ACTIONS: process.env.GITHUB_ACTIONS,
      GITLAB_CI: process.env.GITLAB_CI,
      CIRCLECI: process.env.CIRCLECI,
      BUILDKITE: process.env.BUILDKITE,
      VERCEL: process.env.VERCEL,
      NETLIFY: process.env.NETLIFY,
    };
    delete process.env.CI;
    delete process.env.GITHUB_ACTIONS;
    delete process.env.GITLAB_CI;
    delete process.env.CIRCLECI;
    delete process.env.BUILDKITE;
    delete process.env.VERCEL;
    delete process.env.NETLIFY;
    existsSyncMock.mockReturnValue(false);
    readFileSyncMock.mockReturnValue('');
    confConstructorMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.restoreAllMocks();
  });

  it('delegates local OS-native storage resolution to conf', async () => {
    const { TelemetryStorage } = await import('../storage');

    new TelemetryStorage({ distDir: '.next' });

    expect(confConstructorMock).toHaveBeenCalledWith({
      projectName: 'gt-next',
      cwd: undefined,
    });
  });

  it('uses project cache storage in CI environments', async () => {
    process.env.CI = '1';
    const { TelemetryStorage } = await import('../storage');

    new TelemetryStorage({ distDir: '.next' });

    expect(confConstructorMock).toHaveBeenCalledWith({
      projectName: 'gt-next',
      cwd: '.next/cache',
    });
  });
});
