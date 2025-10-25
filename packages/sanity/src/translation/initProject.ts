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
  const setupTimeoutMs =
    (Number.isFinite(timeoutVal) ? timeoutVal : 600) * 1000;

  const setupResult = await gt.setupProject(uploadResult.uploadedFiles, {
    locales: pluginConfig.getLocales(),
  });

  if (setupResult?.status === 'queued') {
    const { setupJobId } = setupResult;
    const start = Date.now();
    const pollInterval = 2000;

    let setupCompleted = false;
    let setupFailedMessage: string | null = null;

    while (true) {
      const status = await gt.checkSetupStatus(setupJobId);

      if (status.status === 'completed') {
        setupCompleted = true;
        break;
      }
      if (status.status === 'failed') {
        setupFailedMessage = status.error?.message || 'Unknown error';
        break;
      }
      if (Date.now() - start > setupTimeoutMs) {
        setupFailedMessage = 'Timed out while waiting for setup generation';
        break;
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    if (setupCompleted) {
      console.log('Setup successfully completed');
    } else {
      console.log(
        `Setup ${setupFailedMessage ? 'failed' : 'timed out'} — proceeding without setup${
          setupFailedMessage ? ` (${setupFailedMessage})` : ''
        }`
      );
    }
  }

  return true;
}
