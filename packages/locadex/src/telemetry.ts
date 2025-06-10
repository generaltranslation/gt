import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';
import { getLocadexVersion } from './utils/getPaths.js';
import { CliOptions } from './types/cli.js';

let _posthog: PostHog | null = null;
let sentryInitialized = false;
let telemetryEnabled = false;

// Create a PostHog proxy that behaves like PostHog but does nothing when disabled
const posthog = new Proxy({} as PostHog, {
  get(target, prop) {
    if (!telemetryEnabled || !_posthog) {
      // Return no-op functions for all PostHog methods
      if (
        typeof prop === 'string' &&
        ['capture', 'identify', 'alias', 'shutdown'].includes(prop)
      ) {
        return () => {};
      }
      return undefined;
    }
    return _posthog[prop as keyof PostHog];
  },
});

export { posthog };
export { Sentry };

function initializeTelemetry(enabled: boolean) {
  telemetryEnabled = enabled;

  if (!sentryInitialized) {
    Sentry.init({
      dsn: 'https://f542d2155ab069c9de0fcd913ed3ce3b@o4508407294853120.ingest.us.sentry.io/4509441836843008',
      release: getLocadexVersion(),
      enabled,
      tracesSampleRate: 1.0,
      beforeSend: (event) => {
        event.exception?.values?.forEach((exception) => {
          delete exception.stacktrace;
        });
        delete event.server_name;
        return event;
      },
    });
    sentryInitialized = true;
  }

  if (!_posthog && enabled) {
    _posthog = new PostHog('phc_LJRRBlhH8kgjiydp2bKjC7QPMguDoNd1b4QHQArxtha', {
      host: 'https://us.i.posthog.com',
      disableGeoip: true,
    });
  }
}

function updateProgress(status: string) {
  posthog.capture({
    distinctId: 'anonymous',
    event: 'locadex_progress',
    properties: { status },
  });
}

export async function withTelemetry<F>(
  params: {
    enabled: boolean;
    options: CliOptions;
  },
  callback: () => F | Promise<F>
): Promise<F> {
  const { enabled, options } = params;
  initializeTelemetry(enabled);

  if (!enabled) {
    return await callback();
  }

  Sentry.setTag('args.verbose', !!options.verbose);
  Sentry.setTag('args.noTelemetry', !!options.noTelemetry);

  try {
    return await Sentry.startSpan(
      {
        name: 'locadex-execution',
        op: 'locadex.flow',
      },
      async () => {
        updateProgress('start');
        const res = await callback();
        updateProgress('finished');
        return res;
      }
    );
  } catch (e) {
    Sentry.captureException(e);
    throw e;
  } finally {
    await Sentry.flush(3000).then(null, () => {});
    if (_posthog) {
      await _posthog.shutdown();
    }
  }
}

const shutdown = async () => {
  if (_posthog) {
    await _posthog.shutdown();
  }
  process.exit(0);
};

process.on('SIGINT', () => {
  shutdown();
});
process.on('SIGTERM', () => {
  shutdown();
});
process.on('exit', () => {
  if (_posthog) {
    _posthog.shutdown();
  }
});
