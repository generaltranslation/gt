import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';

Sentry.init({
  dsn: 'https://f542d2155ab069c9de0fcd913ed3ce3b@o4508407294853120.ingest.us.sentry.io/4509441836843008',
});

export const posthog = new PostHog(
  'phc_LJRRBlhH8kgjiydp2bKjC7QPMguDoNd1b4QHQArxtha',
  {
    host: 'https://us.i.posthog.com',
    disableGeoip: true,
  }
);

const shutdown = async () => {
  await posthog.shutdown();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  posthog.shutdown();
});
