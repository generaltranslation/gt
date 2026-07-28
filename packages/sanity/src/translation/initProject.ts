import { gt, overrideConfig, pluginConfig } from '../adapter/core';
import type { Secrets } from '../types';

export async function initProject(
  uploadResult: Awaited<ReturnType<typeof gt.uploadSourceFiles>>,
  options: { timeout?: number },
  secrets: Secrets
): Promise<boolean> {
  overrideConfig(secrets);
  // Calculate timeout once for setup fetching
  // Accept number or numeric string, default to 600s
  const timeoutVal =
    options?.timeout !== undefined ? Number(options.timeout) : 600;
  const setupTimeoutSeconds = Number.isFinite(timeoutVal) ? timeoutVal : 600;

  const setupResult = await gt.setupProject(uploadResult.uploadedFiles, {
    locales: pluginConfig.getLocales(),
  });

  if (setupResult.status === 'queued') {
    const { complete, jobs } = await gt.awaitJobs([setupResult.setupJobId], {
      pollingIntervalSeconds: 2,
      timeoutSeconds: setupTimeoutSeconds,
    });
    const [job] = jobs;

    if (job?.status === 'completed') {
      // eslint-disable-next-line no-console
      console.log('Setup successfully completed');
    } else if (!complete) {
      // eslint-disable-next-line no-console
      console.log(
        'Setup timed out — proceeding without setup (Timed out while waiting for setup generation)'
      );
    } else if (job?.status === 'failed') {
      // eslint-disable-next-line no-console
      console.log(
        `Setup failed — proceeding without setup (${job.error?.message ?? 'Unknown error'})`
      );
    } else {
      // eslint-disable-next-line no-console
      console.log('Setup status unknown — proceeding without setup');
    }
  }

  return true;
}
