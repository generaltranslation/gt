import type { withGTConfigProps } from '../config-dir/props/withGTConfigProps';
import { getAnonymousProjectHash } from './projectHash';
import { TelemetryStorage, type TelemetryStorageOptions } from './storage';
import { postTelemetryPayload } from './postTelemetryPayload';
import packageJson from '../../package.json';

export type NextDevTelemetryPayload = {
  eventName: 'GT_NEXT_DEV_SERVER_STARTED';
  eventVersion: 1;
  context: {
    anonymousId: string;
    anonymousProjectHash: string;
    sessionId: string;
  };
  fields: {
    gtNextVersion: string;
    nextVersion: string | null;
    bundler: 'webpack' | 'turbopack';
    compiler: 'babel' | 'swc' | 'none';
    isCI: boolean;
    features: {
      gtServicesEnabled: boolean;
      localDictionary: boolean;
      localTranslations: boolean;
      ssg: boolean;
      localeResolution: boolean;
    };
  };
};

export type RecordNextDevTelemetryOptions = {
  config: Pick<
    withGTConfigProps,
    | 'devServerTelemetry'
    | 'devServerTelemetryUrl'
    | 'experimentalCompilerOptions'
    | 'experimentalEnableSSG'
    | 'experimentalLocaleResolution'
  >;
  bundler: 'webpack' | 'turbopack';
  endpoint?: string | null;
  distDir?: string;
  gtServicesEnabled: boolean;
  localDictionary: boolean;
  localTranslations: boolean;
  storageOptions?: TelemetryStorageOptions;
};

const recordedKeys = new Set<string>();

function isTruthy(value: string | undefined) {
  return value === '1' || value === 'true';
}

function isTelemetryDisabled(config: withGTConfigProps) {
  return (
    config.devServerTelemetry === false ||
    isTruthy(process.env.NEXT_TELEMETRY_DISABLED) ||
    isTruthy(process.env.GT_TELEMETRY_DISABLED) ||
    isTruthy(process.env.DO_NOT_TRACK)
  );
}

function isTelemetryDebug() {
  return (
    isTruthy(process.env.NEXT_TELEMETRY_DEBUG) ||
    isTruthy(process.env.GT_TELEMETRY_DEBUG)
  );
}

function isCI() {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE ||
    process.env.VERCEL ||
    process.env.NETLIFY
  );
}

function getNextVersion() {
  try {
    const nextPackageJson = require('next/package.json');
    return typeof nextPackageJson.version === 'string'
      ? nextPackageJson.version
      : null;
  } catch {
    return null;
  }
}

export function resetNextDevTelemetryForTests() {
  recordedKeys.clear();
}

export function recordNextDevTelemetry(options: RecordNextDevTelemetryOptions) {
  const { config, bundler } = options;
  const endpoint = options.endpoint ?? config.devServerTelemetryUrl;

  if (isTelemetryDisabled(config) || endpoint === null) return;

  const key = `${bundler}:${process.cwd()}`;
  if (recordedKeys.has(key)) return;
  recordedKeys.add(key);

  const storage = new TelemetryStorage({
    distDir: options.distDir,
    ...options.storageOptions,
  });
  if (!storage.isEnabled) return;

  void submitNextDevTelemetry({ ...options, endpoint, storage });
}

async function submitNextDevTelemetry(
  options: RecordNextDevTelemetryOptions & {
    endpoint: string | undefined;
    storage: TelemetryStorage;
  }
) {
  const anonymousId = options.storage.anonymousId;
  const anonymousProjectHash = await getAnonymousProjectHash(options.storage);

  if (!anonymousId || !anonymousProjectHash) return;

  const payload: NextDevTelemetryPayload = {
    eventName: 'GT_NEXT_DEV_SERVER_STARTED',
    eventVersion: 1,
    context: {
      anonymousId,
      anonymousProjectHash,
      sessionId: options.storage.sessionId,
    },
    fields: {
      gtNextVersion: packageJson.version,
      nextVersion: getNextVersion(),
      bundler: options.bundler,
      compiler: options.config.experimentalCompilerOptions?.type || 'none',
      isCI: isCI(),
      features: {
        gtServicesEnabled: options.gtServicesEnabled,
        localDictionary: options.localDictionary,
        localTranslations: options.localTranslations,
        ssg: !!options.config.experimentalEnableSSG,
        localeResolution: !!options.config.experimentalLocaleResolution,
      },
    },
  };

  if (isTelemetryDebug()) {
    console.error('[gt-next telemetry] ' + JSON.stringify(payload, null, 2));
    return;
  }

  options.storage.notify();

  if (!options.endpoint) return;
  await postTelemetryPayload(options.endpoint, payload);
}
