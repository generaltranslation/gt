import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { registryUrl, releaseError, requireCondition } from './shared.mjs';

const exec = promisify(execFile);

export function nativeOperations() {
  return {
    env: process.env,
    log: (message) => process.stdout.write(`${message}\n`),
    read: (file) => fs.readFile(file),
    write: (file, content) => fs.writeFile(file, content),
    list: (directory) => fs.readdir(directory),
    exists: async (file) => {
      try {
        await fs.access(file);
        return true;
      } catch (error) {
        if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false;
        throw error;
      }
    },
    temporaryDirectory: () =>
      fs.mkdtemp(path.join(tmpdir(), 'gt-auto-jsx-release-')),
    run: async (command, args, { cwd, binary = false } = {}) => {
      try {
        const result = await exec(command, args, {
          cwd,
          encoding: binary ? 'buffer' : 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          timeout: 60_000,
        });
        return result.stdout;
      } catch (error) {
        throw releaseError('A release command failed', [
          command,
          String(error.stderr || error.stdout || error.message),
        ]);
      }
    },
    registry: async (name) => {
      const response = await fetch(
        `${registryUrl}/${encodeURIComponent(name)}`,
        {
          headers: { accept: 'application/vnd.npm.install-v1+json' },
          signal: AbortSignal.timeout(15_000),
        }
      );
      if (response.status === 404) return undefined;
      requireCondition(
        response.ok,
        'Registry metadata could not be verified',
        `${name}: HTTP ${response.status}`
      );
      const metadata = await response.json();
      requireCondition(
        metadata.name === name &&
          metadata.versions &&
          typeof metadata.versions === 'object' &&
          !Array.isArray(metadata.versions),
        'Registry metadata has an unexpected shape',
        name
      );
      return metadata;
    },
  };
}
