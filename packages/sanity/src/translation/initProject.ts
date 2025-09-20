import { gt, overrideConfig } from '../adapter/core';
import type { Secrets } from '../types';

export async function initProject(
  uploadResult: Awaited<ReturnType<typeof gt.uploadSourceFiles>>,
  options: { timeout?: number },
  secrets: Secrets
): Promise<boolean> {
  overrideConfig(secrets);
  const setupDecision = await Promise.resolve(gt.shouldSetupProject?.())
    .then((v: any) => v)
    .catch(() => ({ shouldSetupProject: false }));
  const shouldSetupProject = Boolean(setupDecision?.shouldSetupProject);

  // Step 2: Setup if needed and poll until complete
  if (shouldSetupProject) {
    // Calculate timeout once for setup fetching
    // Accept number or numeric string, default to 600s
    const timeoutVal =
      options?.timeout !== undefined ? Number(options.timeout) : 600;
    const setupTimeoutMs =
      (Number.isFinite(timeoutVal) ? timeoutVal : 600) * 1000;

    const { setupJobId } = await gt.setupProject(uploadResult.uploadedFiles);

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
      return true;
    } else {
      console.log(`Setup ${setupFailedMessage ? 'failed' : 'timed out'} `);
      return false;
    }
  } else {
    console.log('Setup not needed');
  }
  return true;
}
