import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const execMock = vi.hoisted(() => vi.fn());

vi.mock('child_process', () => ({
  exec: execMock,
}));

type StoreData = Record<string, unknown>;

function createStore(initial: StoreData = {}) {
  const data = { ...initial };
  return {
    data,
    get: vi.fn((key: string) => data[key]),
    set: vi.fn((key: string, value: unknown) => {
      data[key] = value;
    }),
  };
}

async function flushPromises() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('next dev telemetry', () => {
  let savedEnv: NodeJS.ProcessEnv;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    savedEnv = { ...process.env };
    process.env.NODE_ENV = 'development';
    delete process.env.CI;
    delete process.env.NEXT_TELEMETRY_DISABLED;
    delete process.env.GT_TELEMETRY_DISABLED;
    delete process.env.DO_NOT_TRACK;
    delete process.env.NEXT_TELEMETRY_DEBUG;
    delete process.env.GT_TELEMETRY_DEBUG;
    delete process.env.REPOSITORY_URL;

    execMock.mockReset();
    execMock.mockImplementation(
      (
        _command: string,
        _options: unknown,
        callback: (error: Error | null, stdout: string) => void
      ) => callback(null, 'git@github.com:org/repo.git\n')
    );

    fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const telemetry = await import('../nextDevTelemetry');
    telemetry.resetNextDevTelemetryForTests();
  });

  afterEach(() => {
    process.env = savedEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('persists anonymous ID and salt in the configured store', async () => {
    const { TelemetryStorage } = await import('../storage');
    const store = createStore();
    const storage = new TelemetryStorage({ store });

    const anonymousId = storage.anonymousId;
    const salt = storage.salt;

    expect(anonymousId).toHaveLength(64);
    expect(salt).toHaveLength(32);
    expect(storage.anonymousId).toBe(anonymousId);
    expect(storage.salt).toBe(salt);
    expect(store.data['telemetry.anonymousId']).toBe(anonymousId);
    expect(store.data['telemetry.salt']).toBe(salt);
  });

  it('computes a stable salted anonymous project hash', async () => {
    const { TelemetryStorage } = await import('../storage');
    const store = createStore({
      'telemetry.salt': 'salt-one',
    });
    const storage = new TelemetryStorage({ store });

    expect(storage.oneWayHash('raw-input')).toBe(
      storage.oneWayHash('raw-input')
    );

    const otherStorage = new TelemetryStorage({
      store: createStore({ 'telemetry.salt': 'salt-two' }),
    });
    expect(otherStorage.oneWayHash('raw-input')).not.toBe(
      storage.oneWayHash('raw-input')
    );
  });

  it('uses Next.js raw dedupe fallback order without exposing raw values', async () => {
    const { getRawDedupeInput } = await import('../projectHash');

    expect(await getRawDedupeInput()).toBe('git@github.com:org/repo.git');

    execMock.mockImplementationOnce(
      (_command: string, _options: unknown, callback: (error: Error) => void) =>
        callback(new Error('missing remote'))
    );
    process.env.REPOSITORY_URL = 'https://example.com/fallback.git';
    expect(await getRawDedupeInput()).toBe('https://example.com/fallback.git');

    execMock.mockImplementationOnce(
      (_command: string, _options: unknown, callback: (error: Error) => void) =>
        callback(new Error('missing remote'))
    );
    delete process.env.REPOSITORY_URL;
    expect(await getRawDedupeInput()).toBe(process.cwd());
  });

  it('posts only anonymous and coarse fields for webpack dev', async () => {
    const { recordNextDevTelemetry } = await import('../nextDevTelemetry');
    const store = createStore({
      'telemetry.anonymousId': 'a'.repeat(64),
      'telemetry.salt': 'test-salt',
      'telemetry.notifiedAt': '1',
    });

    recordNextDevTelemetry({
      config: {
        devServerTelemetry: true,
        devServerTelemetryUrl: 'https://api.example.com/v2/telemetry/next-dev',
        experimentalCompilerOptions: { type: 'swc' },
        experimentalEnableSSG: true,
        experimentalLocaleResolution: true,
      },
      bundler: 'webpack',
      gtServicesEnabled: true,
      localDictionary: true,
      localTranslations: false,
      storageOptions: { store },
    });

    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(init.body);
    const serialized = JSON.stringify(payload);

    expect(url).toBe('https://api.example.com/v2/telemetry/next-dev');
    expect(payload.context.anonymousId).toBe('a'.repeat(64));
    expect(payload.context.anonymousProjectHash).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.context.sessionId).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.fields.bundler).toBe('webpack');
    expect(payload.fields.compiler).toBe('swc');
    expect(payload.fields.features).toEqual({
      gtServicesEnabled: true,
      localDictionary: true,
      localTranslations: false,
      ssg: true,
      localeResolution: true,
    });
    expect(serialized).not.toContain('projectId');
    expect(serialized).not.toContain('anonymousProjectId');
    expect(serialized).not.toContain('git@github.com:org/repo.git');
    expect(serialized).not.toContain(process.cwd());
  });

  it('does not send when disabled by env or config', async () => {
    const { recordNextDevTelemetry, resetNextDevTelemetryForTests } =
      await import('../nextDevTelemetry');
    const baseOptions = {
      config: {
        devServerTelemetry: true,
        devServerTelemetryUrl: 'https://api.example.com/v2/telemetry/next-dev',
        experimentalCompilerOptions: { type: 'none' as const },
      },
      bundler: 'webpack' as const,
      gtServicesEnabled: false,
      localDictionary: false,
      localTranslations: false,
      storageOptions: { store: createStore() },
    };

    process.env.NEXT_TELEMETRY_DISABLED = '1';
    recordNextDevTelemetry(baseOptions);
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();

    resetNextDevTelemetryForTests();
    delete process.env.NEXT_TELEMETRY_DISABLED;
    process.env.GT_TELEMETRY_DISABLED = '1';
    recordNextDevTelemetry(baseOptions);
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();

    resetNextDevTelemetryForTests();
    delete process.env.GT_TELEMETRY_DISABLED;
    process.env.DO_NOT_TRACK = 'true';
    recordNextDevTelemetry(baseOptions);
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();

    resetNextDevTelemetryForTests();
    delete process.env.DO_NOT_TRACK;
    recordNextDevTelemetry({
      ...baseOptions,
      config: { ...baseOptions.config, devServerTelemetry: false },
    });
    await flushPromises();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prints debug payload without calling fetch', async () => {
    const { recordNextDevTelemetry } = await import('../nextDevTelemetry');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.GT_TELEMETRY_DEBUG = '1';

    recordNextDevTelemetry({
      config: {
        devServerTelemetry: true,
        devServerTelemetryUrl: 'https://api.example.com/v2/telemetry/next-dev',
        experimentalCompilerOptions: { type: 'babel' },
      },
      bundler: 'turbopack',
      gtServicesEnabled: false,
      localDictionary: false,
      localTranslations: true,
      storageOptions: {
        store: createStore({
          'telemetry.anonymousId': 'b'.repeat(64),
          'telemetry.salt': 'test-salt',
        }),
      },
    });

    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[gt-next telemetry]')
    );
    expect(errorSpy.mock.calls[0][0]).not.toContain('projectId');
    expect(errorSpy.mock.calls[0][0]).not.toContain('anonymousProjectId');
  });

  it('dedupes repeated records in one process', async () => {
    const { recordNextDevTelemetry } = await import('../nextDevTelemetry');
    const options = {
      config: {
        devServerTelemetry: true,
        devServerTelemetryUrl: 'https://api.example.com/v2/telemetry/next-dev',
        experimentalCompilerOptions: { type: 'none' as const },
      },
      bundler: 'webpack' as const,
      gtServicesEnabled: false,
      localDictionary: false,
      localTranslations: false,
      storageOptions: {
        store: createStore({
          'telemetry.anonymousId': 'c'.repeat(64),
          'telemetry.salt': 'test-salt',
          'telemetry.notifiedAt': '1',
        }),
      },
    };

    recordNextDevTelemetry(options);
    recordNextDevTelemetry(options);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
