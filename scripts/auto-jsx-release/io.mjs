import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  registryUrl,
  releaseError,
  releaseRepository,
  requireCondition,
} from './shared.mjs';

const exec = promisify(execFile);

export function nativeOperations() {
  const github = async (resource) => {
    const token = process.env.GH_TOKEN;
    requireCondition(
      typeof token === 'string' && token.length > 0,
      'GH_TOKEN is required to verify the merged release pull request'
    );
    let response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${releaseRepository}/${resource}`,
        {
          method: 'GET',
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
          redirect: 'error',
          signal: AbortSignal.timeout(15_000),
        }
      );
    } catch {
      // Network errors can include request headers. Never forward them or tokens.
      throw releaseError(
        'GitHub release authorization could not be verified',
        resource
      );
    }
    requireCondition(
      response.ok,
      'GitHub release authorization could not be verified',
      `${resource}: HTTP ${response.status}`
    );
    try {
      return await response.json();
    } catch {
      throw releaseError(
        'GitHub returned invalid release authorization metadata',
        resource
      );
    }
  };
  return {
    env: process.env,
    log: (message) => process.stdout.write(`${message}\n`),
    read: (file) => fs.readFile(file),
    write: (file, content) => fs.writeFile(file, content),
    append: (file, content) => fs.appendFile(file, content),
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
    associatedPullRequests: async (sha) => {
      requireCondition(
        typeof sha === 'string' &&
          sha.length === 40 &&
          /^[a-f0-9]{40}$/.test(sha),
        'An exact Git SHA is required for associated pull requests'
      );
      const result = [];
      // Keep the request bounded and fail closed if an unusually shared commit
      // has more associations than this release channel can safely inspect.
      for (let page = 1; page <= 10; page++) {
        const pullRequests = await github(
          `commits/${sha}/pulls?per_page=100&page=${page}`
        );
        requireCondition(
          Array.isArray(pullRequests),
          'GitHub returned an invalid associated pull request list'
        );
        result.push(...pullRequests);
        if (pullRequests.length < 100) return result;
      }
      throw releaseError(
        'The release commit has too many associated pull requests to verify'
      );
    },
    pullRequest: async (number) => {
      requireCondition(
        Number.isSafeInteger(number) && number > 0,
        'A positive pull request number is required'
      );
      const pullRequest = await github(`pulls/${number}`);
      requireCondition(
        pullRequest &&
          typeof pullRequest === 'object' &&
          !Array.isArray(pullRequest) &&
          pullRequest.number === number,
        'GitHub returned invalid pull request details'
      );
      return pullRequest;
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
