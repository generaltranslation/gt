import { createHash, randomBytes, type BinaryLike } from 'crypto';
import fs from 'fs';
import path from 'path';
import Conf from 'conf';
import { isCI } from './utils';

const TELEMETRY_KEY_ENABLED = 'telemetry.enabled';
const TELEMETRY_KEY_NOTIFY_DATE = 'telemetry.notifiedAt';
const TELEMETRY_KEY_ID = 'telemetry.anonymousId';
const TELEMETRY_KEY_SALT = 'telemetry.salt';

type TelemetryStore = {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
};

export type TelemetryStorageOptions = {
  distDir?: string;
  store?: TelemetryStore;
};

function isDockerLike() {
  try {
    if (fs.existsSync('/.dockerenv')) return true;
  } catch {
    return false;
  }

  try {
    return fs.readFileSync('/proc/self/cgroup', 'utf8').includes('docker');
  } catch {
    return false;
  }
}

export function getStorageDirectory(distDir = '.next') {
  if (isCI() || isDockerLike()) {
    return path.join(distDir, 'cache');
  }
  return undefined;
}

export class TelemetryStorage {
  readonly sessionId = randomBytes(32).toString('hex');
  private readonly store: TelemetryStore | null;

  constructor({ distDir = '.next', store }: TelemetryStorageOptions = {}) {
    if (store) {
      this.store = store;
      return;
    }

    try {
      this.store = new Conf({
        projectName: 'gt-next',
        cwd: getStorageDirectory(distDir),
      });
    } catch {
      this.store = null;
    }
  }

  get isEnabled() {
    if (!this.store) return false;

    try {
      return this.store.get(TELEMETRY_KEY_ENABLED) !== false;
    } catch {
      return false;
    }
  }

  notify() {
    if (!this.isEnabled || !this.store) return;

    try {
      if (this.store.get(TELEMETRY_KEY_NOTIFY_DATE)) return;
      this.store.set(TELEMETRY_KEY_NOTIFY_DATE, Date.now().toString());
      process.stderr.write(
        [
          'Attention: General Translation now collects completely anonymous telemetry regarding gt-next development usage.',
          "This information is used to shape General Translation's roadmap and prioritize features.",
          'You can learn more, including how to opt out, by visiting:',
          'https://generaltranslation.com/docs/telemetry',
          '',
        ].join('\n')
      );
    } catch {
      return;
    }
  }

  get anonymousId() {
    return this.getOrCreateRandomHex(TELEMETRY_KEY_ID, 32);
  }

  get salt() {
    return this.getOrCreateRandomHex(TELEMETRY_KEY_SALT, 16);
  }

  oneWayHash(payload: BinaryLike) {
    const salt = this.salt;
    if (!salt) return null;

    const hash = createHash('sha256');
    hash.update(salt);
    hash.update(payload);
    return hash.digest('hex');
  }

  private getOrCreateRandomHex(key: string, bytes: number) {
    if (!this.store) return null;

    try {
      const value = this.store.get(key);
      if (typeof value === 'string' && value.length > 0) return value;

      const generated = randomBytes(bytes).toString('hex');
      this.store.set(key, generated);
      return generated;
    } catch {
      return null;
    }
  }
}
