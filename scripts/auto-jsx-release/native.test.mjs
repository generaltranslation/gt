import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectArtifact } from './artifact.mjs';
import { expectedSha } from './fixtures.mjs';
import { nativeOperations } from './io.mjs';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('native release adapters', () => {
  it('treats files in the packages directory as non-package entries', async () => {
    const ops = nativeOperations();
    const root = await ops.temporaryDirectory();
    await fs.writeFile(path.join(root, 'README.md'), 'Package documentation');
    expect(await ops.exists(path.join(root, 'README.md/package.json'))).toBe(
      false
    );
    expect(await ops.exists(path.join(root, 'absent/package.json'))).toBe(
      false
    );
  });

  it('packs a real workspace dependency without running package scripts', async () => {
    const ops = nativeOperations();
    const root = await ops.temporaryDirectory();
    const appDirectory = path.join(root, 'packages/app');
    const coreDirectory = path.join(root, 'packages/core');
    await fs.mkdir(path.join(appDirectory, 'dist'), { recursive: true });
    await fs.mkdir(coreDirectory, { recursive: true });
    await fs.mkdir(path.join(appDirectory, 'node_modules/@fixture'), {
      recursive: true,
    });
    await fs.symlink(
      coreDirectory,
      path.join(appDirectory, 'node_modules/@fixture/core'),
      'dir'
    );
    await fs.writeFile(
      path.join(root, 'package.json'),
      JSON.stringify({ private: true, packageManager: 'pnpm@10.20.0' })
    );
    await fs.writeFile(
      path.join(root, 'pnpm-workspace.yaml'),
      "packages:\n  - 'packages/*'\n"
    );
    const source = {
      name: '@fixture/app',
      version: '1.0.0-auto-jsx.0',
      main: './dist/index.js',
      files: ['dist'],
      exports: { '.': './dist/index.js' },
      dependencies: { '@fixture/core': 'workspace:*' },
      scripts: {
        prepack: 'node -e "throw new Error(\'prepack must not run\')"',
        prepare: 'node -e "throw new Error(\'prepare must not run\')"',
      },
    };
    const core = { name: '@fixture/core', version: '2.0.0' };
    await fs.writeFile(
      path.join(appDirectory, 'package.json'),
      JSON.stringify(source)
    );
    await fs.writeFile(
      path.join(coreDirectory, 'package.json'),
      JSON.stringify(core)
    );
    await fs.writeFile(
      path.join(appDirectory, 'dist/index.js'),
      'export const fixture = true;\n'
    );
    const tarball = path.join(root, 'fixture.tgz');
    await ops.run(
      'pnpm',
      ['--config.ignore-scripts=true', 'pack', '--out', tarball, '--json'],
      { cwd: appDirectory }
    );
    const artifact = await inspectArtifact(
      ops,
      tarball,
      source,
      new Map([
        [source.name, { manifest: source }],
        [core.name, { manifest: core }],
      ])
    );
    expect(artifact.manifest.dependencies).toEqual({
      '@fixture/core': '2.0.0',
    });
    expect(artifact.integrity).toMatch(/^sha512-/);
    expect(await ops.exists(tarball)).toBe(true);
  });

  it('uses only the npm registry and returns absent packages only for 404', async () => {
    const fetch = vi.fn().mockResolvedValue({ status: 404 });
    vi.stubGlobal('fetch', fetch);
    expect(await nativeOperations().registry('@fixture/app')).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/%40fixture%2Fapp',
      expect.objectContaining({
        headers: { accept: 'application/vnd.npm.install-v1+json' },
      })
    );
  });

  it.each([401, 403, 429, 500])(
    'fails closed on registry HTTP %s',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status, ok: false }));
      await expect(nativeOperations().registry('gt-next')).rejects.toThrow(
        `HTTP ${status}`
      );
    }
  );

  it.each([
    { name: 'wrong-package', versions: {} },
    { name: 'gt-next', versions: [] },
    { name: 'gt-next' },
  ])('rejects malformed registry metadata %j', async (metadata) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => metadata })
    );
    await expect(nativeOperations().registry('gt-next')).rejects.toThrow(
      'unexpected shape'
    );
  });
});

describe('native read-only GitHub release authorization', () => {
  it('queries only the fixed repository and disables redirects for authenticated GETs', async () => {
    vi.stubEnv('GH_TOKEN', 'fixture-github-token');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ number: 2251 }] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ number: 2251 }),
      });
    vi.stubGlobal('fetch', fetch);
    const ops = nativeOperations();
    expect(await ops.associatedPullRequests(expectedSha)).toEqual([
      { number: 2251 },
    ]);
    expect(await ops.pullRequest(2251)).toEqual({ number: 2251 });
    const request = expect.objectContaining({
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: 'Bearer fixture-github-token',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      redirect: 'error',
      signal: expect.any(AbortSignal),
    });
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `https://api.github.com/repos/generaltranslation/gt/commits/${expectedSha}/pulls?per_page=100&page=1`,
      request
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://api.github.com/repos/generaltranslation/gt/pulls/2251',
      request
    );
  });

  it('reads every association page before reporting that no release PR matches', async () => {
    vi.stubEnv('GH_TOKEN', 'fixture-github-token');
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      number: index + 1,
    }));
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => firstPage })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ number: 2251 }],
      });
    vi.stubGlobal('fetch', fetch);
    expect(
      await nativeOperations().associatedPullRequests(expectedSha)
    ).toEqual([...firstPage, { number: 2251 }]);
    expect(fetch.mock.calls[1][0]).toBe(
      `https://api.github.com/repos/generaltranslation/gt/commits/${expectedSha}/pulls?per_page=100&page=2`
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('fails closed instead of authorizing an incomplete pagination result', async () => {
    vi.stubEnv('GH_TOKEN', 'fixture-github-token');
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        Array.from({ length: 100 }, (_, index) => ({ number: index + 1 })),
    });
    vi.stubGlobal('fetch', fetch);
    await expect(
      nativeOperations().associatedPullRequests(expectedSha)
    ).rejects.toThrow('too many associated');
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  it.each([401, 403, 404, 429, 500])(
    'fails closed on GitHub HTTP %s',
    async (status) => {
      vi.stubEnv('GH_TOKEN', 'fixture-github-token');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
      await expect(
        nativeOperations().associatedPullRequests(expectedSha)
      ).rejects.toThrow(`HTTP ${status}`);
    }
  );

  it('does not send an unauthenticated API request when GH_TOKEN is absent', async () => {
    vi.stubEnv('GH_TOKEN', undefined);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(
      nativeOperations().associatedPullRequests(expectedSha)
    ).rejects.toThrow('GH_TOKEN');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['network', 'json'])(
    'never includes a token-bearing %s failure in a diagnostic',
    async (mode) => {
      const token = 'fixture-sensitive-token-do-not-log';
      vi.stubEnv('GH_TOKEN', token);
      const fail = () => {
        throw new Error(`Request included Bearer ${token}`);
      };
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockImplementation(
            mode === 'network' ? fail : async () => ({ ok: true, json: fail })
          )
      );
      const error = await nativeOperations()
        .associatedPullRequests(expectedSha)
        .catch((caught) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('GitHub');
      expect(error.message).not.toContain(token);
      expect(error.cause).toBeUndefined();
    }
  );

  it.each([null, {}, { message: 'API error' }])(
    'rejects a malformed associated PR list %j',
    async (body) => {
      vi.stubEnv('GH_TOKEN', 'fixture-github-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => body })
      );
      await expect(
        nativeOperations().associatedPullRequests(expectedSha)
      ).rejects.toThrow('invalid associated');
    }
  );

  it.each([null, [], {}, { number: 2252 }, { number: '2251' }])(
    'rejects malformed full PR details %j',
    async (body) => {
      vi.stubEnv('GH_TOKEN', 'fixture-github-token');
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => body })
      );
      await expect(nativeOperations().pullRequest(2251)).rejects.toThrow(
        'invalid pull request details'
      );
    }
  );

  it.each([undefined, '', 'HEAD', `${expectedSha}/pulls`, `${expectedSha}\n`])(
    'rejects an invalid SHA %j before network access',
    async (sha) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(
        nativeOperations().associatedPullRequests(sha)
      ).rejects.toThrow('exact Git SHA');
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it.each([undefined, '2251', -1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects an invalid PR number %j before network access',
    async (number) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      await expect(nativeOperations().pullRequest(number)).rejects.toThrow(
        'positive pull request'
      );
      expect(fetch).not.toHaveBeenCalled();
    }
  );
});
