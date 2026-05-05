import { exec } from 'child_process';
import { TelemetryStorage } from './storage';

export async function getGitRemoteOriginUrl(timeoutMs = 1000) {
  try {
    const stdout = await new Promise<Buffer | string>((resolve, reject) => {
      exec(
        'git config --local --get remote.origin.url',
        {
          timeout: timeoutMs,
          windowsHide: true,
        },
        (error, output) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(output);
        }
      );
    });

    const remote = String(stdout).trim();
    return remote || null;
  } catch {
    return null;
  }
}

export async function getRawDedupeInput() {
  return (
    (await getGitRemoteOriginUrl()) ||
    process.env.REPOSITORY_URL ||
    process.cwd()
  );
}

export async function getAnonymousProjectHash(storage: TelemetryStorage) {
  return storage.oneWayHash(await getRawDedupeInput());
}
