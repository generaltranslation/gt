import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { publishRelease, parseArguments } from './publish.mjs';
import { versionPackages } from './version.mjs';
import { digest, isChannelVersion, releaseBranch } from './shared.mjs';
import { expectedSha, releaseFixture } from './fixtures.mjs';

const publications = (fixture) =>
  fixture.ops.run.mock.calls.filter(([command]) => command === 'npm');
const packs = (fixture) =>
  fixture.ops.run.mock.calls.filter(
    ([command, args]) => command === 'pnpm' && args.includes('pack')
  );

describe('experimental release arguments and versions', () => {
  it('defaults to validation and requires an explicit execution flag', () => {
    expect(parseArguments(['--expected-sha', expectedSha])).toEqual({
      expectedSha,
      execute: false,
    });
    expect(
      parseArguments(['--execute', '--expected-sha', expectedSha])
    ).toEqual({ expectedSha, execute: true });
  });

  it.each(
    [
      [],
      ['--expected-sha'],
      ['--expected-sha', 'HEAD'],
      ['--expected-sha', expectedSha.slice(0, 8)],
      ['--expected-sha', expectedSha.toUpperCase()],
      ['--expected-sha', `${expectedSha}\n`],
      ['--tag', 'latest'],
      ['--tag', 'bin'],
      ['--registry', 'https://example.invalid'],
      ['--execute', '--execute', '--expected-sha', expectedSha],
      ['--expected-sha', expectedSha, '--expected-sha', expectedSha],
      ['--expected-sha', expectedSha, '--execute=true'],
    ].map((args) => [args])
  )('rejects ambiguous or overriding arguments %j', (args) => {
    expect(() => parseArguments(args)).toThrow();
  });

  it.each([
    '1.2.3',
    '1.2.3-alpha.0',
    '1.2.3-bin.0',
    '1.2.3-auto-jsx',
    '1.2.3-auto-jsx.01',
    '01.2.3-auto-jsx.0',
    '1.2.3-auto-jsx.0+metadata',
    '1.2.3-auto-jsx.0\n',
    undefined,
  ])('rejects a non-channel version %j', (version) => {
    expect(isChannelVersion(version)).toBe(false);
  });

  it('accepts only a numbered auto-jsx prerelease', () => {
    expect(isChannelVersion('11.2.0-auto-jsx.0')).toBe(true);
    expect(isChannelVersion('11.2.0-auto-jsx.102')).toBe(true);
  });
});

describe('release guards before packing or publishing', () => {
  it.each([
    ['wrong branch', (f) => (f.context.branch = 'main')],
    ['another prerelease branch', (f) => (f.context.branch = 'iris')],
    ['wrong SHA', (f) => (f.context.sha = 'a'.repeat(40))],
    [
      'dirty tracked file',
      (f) => (f.context.dirty = ' M packages/next/package.json'),
    ],
    [
      'staged tracked file',
      (f) => (f.context.dirty = 'M  packages/next/package.json'),
    ],
    ['pending changeset', (f) => f.context.pending.push('new-feature.md')],
    [
      'legacy changeset directory',
      (f) => f.context.pending.push('legacy-change'),
    ],
    ['exited pre mode', (f) => f.context.setPreState((p) => (p.mode = 'exit'))],
    ['wrong pre tag', (f) => f.context.setPreState((p) => (p.tag = 'latest'))],
    [
      'stable version',
      (f) => f.context.setManifest('gt-next', (p) => (p.version = '11.2.0')),
    ],
    [
      'foreign prerelease',
      (f) =>
        f.context.setManifest(
          'generaltranslation',
          (p) => (p.version = '9.2.1-auto-jsx.0')
        ),
    ],
    [
      'inconsistent fixed group',
      (f) =>
        f.context.setManifest(
          'gt-react',
          (p) => (p.version = '11.2.0-auto-jsx.1')
        ),
    ],
    [
      'private candidate',
      (f) => f.context.setManifest('gt-next', (p) => (p.private = true)),
    ],
  ])('aborts on %s', async (_label, alter) => {
    const fixture = releaseFixture();
    alter(fixture);
    await expect(publishRelease(fixture)).rejects.toThrow();
    expect(packs(fixture)).toHaveLength(0);
    expect(publications(fixture)).toHaveLength(0);
  });

  it.each([
    ['GITHUB_EVENT_NAME', 'workflow_dispatch'],
    ['GITHUB_REPOSITORY', 'someone/gt'],
    ['GITHUB_REF', 'refs/heads/main'],
    ['GITHUB_SHA', 'a'.repeat(40)],
    ['ACTIONS_ID_TOKEN_REQUEST_TOKEN', ''],
    ['ACTIONS_ID_TOKEN_REQUEST_URL', ''],
  ])('requires authorized release push context: %s', async (key, value) => {
    const fixture = releaseFixture();
    fixture.ops.env[key] = value;
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'branch push'
    );
    expect(packs(fixture)).toHaveLength(0);
    expect(publications(fixture)).toHaveLength(0);
  });
});

describe('all-package artifact preflight', () => {
  it('packs and validates nine packages without publishing by default', async () => {
    const fixture = releaseFixture();
    const report = await publishRelease(fixture);
    expect(report.candidates).toHaveLength(9);
    expect(report.execute).toBe(false);
    expect(report.published).toEqual([]);
    expect(packs(fixture)).toHaveLength(9);
    expect(publications(fixture)).toHaveLength(0);
    expect(report.candidates.map((p) => p.name)).not.toContain(
      'generaltranslation'
    );
    expect(
      fixture.context.files.has(
        path.join(report.directory, 'release-plan.json')
      )
    ).toBe(true);
    for (const [, args] of packs(fixture)) {
      expect(args[0]).toBe('--config.ignore-scripts=true');
    }
  });

  it.each([
    ['wrong name', (a) => (a.manifest.name = 'unrelated-package')],
    ['wrong version', (a) => (a.manifest.version = '1.0.0')],
    ['private tarball', (a) => (a.manifest.private = true)],
    [
      'latest publishConfig',
      (a) => (a.manifest.publishConfig = { tag: 'latest' }),
    ],
    ['bin publishConfig', (a) => (a.manifest.publishConfig = { tag: 'bin' })],
    [
      'alternate registry',
      (a) =>
        (a.manifest.publishConfig = { registry: 'https://example.invalid' }),
    ],
    [
      'restricted access',
      (a) => (a.manifest.publishConfig = { access: 'restricted' }),
    ],
    [
      'publish directory',
      (a) => (a.manifest.publishConfig = { directory: 'other' }),
    ],
    [
      'workspace reference',
      (a) => (a.manifest.dependencies.gt = 'workspace:*'),
    ],
    ['file reference', (a) => (a.manifest.dependencies.gt = 'file:../cli')],
    [
      'stale internal dependency',
      (a) => (a.manifest.dependencies.gt = '2.20.0'),
    ],
    ['missing reviewed dependency', (a) => delete a.manifest.dependencies.gt],
    ['missing entrypoint', (a) => (a.entries = ['package/package.json'])],
    ['path traversal', (a) => a.entries.push('package/../outside.js')],
    ['absolute path', (a) => a.entries.push('/tmp/outside.js')],
    ['duplicate entry', (a) => a.entries.push('package/package.json')],
    ['archive symlink', (a) => (a.type = 'l')],
  ])(
    'rejects %s in the final candidate before any publish',
    async (_label, alter) => {
      const fixture = releaseFixture();
      fixture.context.onPack = (archive) => {
        if (archive.manifest.name === 'locadex') alter(archive);
      };
      await expect(
        publishRelease({ ...fixture, execute: true })
      ).rejects.toThrow();
      expect(packs(fixture)).toHaveLength(9);
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it.each(['missing', 'invalid header'])(
    'rejects %s Next WASM',
    async (mode) => {
      const fixture = releaseFixture();
      fixture.context.onPack = (archive) => {
        if (archive.manifest.name !== 'gt-next') return;
        if (mode === 'missing') {
          archive.entries = archive.entries.filter(
            (entry) => !entry.endsWith('.wasm')
          );
        } else {
          archive.wasm = Buffer.from('this is not wasm');
        }
      };
      await expect(publishRelease(fixture)).rejects.toThrow(/SWC plugin|WASM/);
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it('retains only the known stable Next config.mjs export exception', async () => {
    const fixture = releaseFixture();
    fixture.context.setManifest('gt-next', (manifest) => {
      manifest.exports['./config'] = { import: './dist/config.mjs' };
    });
    await expect(publishRelease(fixture)).resolves.toHaveProperty(
      'execute',
      false
    );
  });

  it.each([
    'main',
    'module',
    'types',
    'bin',
    'other export',
    'other condition',
  ])('does not extend the known config exception to %s', async (field) => {
    const fixture = releaseFixture();
    fixture.context.setManifest('gt-next', (manifest) => {
      const target = './dist/config.mjs';
      manifest.exports['./config'] = { import: target };
      if (field === 'other export') {
        manifest.exports['./other'] = { import: target };
      } else if (field === 'other condition') {
        manifest.exports['./config'].default = target;
      } else {
        manifest[field] = target;
      }
    });
    await expect(publishRelease(fixture)).rejects.toThrow(
      'entrypoint is missing'
    );
    expect(publications(fixture)).toHaveLength(0);
  });

  it.each(['./config-other', './server'])(
    'rejects another missing Next export %s',
    async (key) => {
      const fixture = releaseFixture();
      fixture.context.setManifest('gt-next', (manifest) => {
        manifest.exports[key] = { import: './dist/missing.mjs' };
      });
      await expect(publishRelease(fixture)).rejects.toThrow(
        'entrypoint is missing'
      );
    }
  );

  it('does not apply the Next config exception to another package', async () => {
    const fixture = releaseFixture();
    fixture.context.setManifest('gt-react', (manifest) => {
      manifest.exports['./config'] = { import: './dist/config.mjs' };
    });
    await expect(publishRelease(fixture)).rejects.toThrow(
      'entrypoint is missing'
    );
  });

  function cliTypesFixture(name = 'gt') {
    const fixture = releaseFixture();
    fixture.context.setManifest(name, (manifest) => {
      manifest.exports['./types'] = {
        import: './dist/types.js',
        types: './dist/types.d.ts',
      };
    });
    fixture.context.onPack = (archive) => {
      if (archive.manifest.name === name) {
        archive.entries.push(
          'package/dist/types/index.js',
          'package/dist/types/index.d.ts'
        );
      }
    };
    return fixture;
  }

  it('requires the published CLI type directory for its existing flat mapping', async () => {
    await expect(publishRelease(cliTypesFixture())).resolves.toHaveProperty(
      'execute',
      false
    );
  });

  it('rejects a shipped CLI type mapping that differs from the reviewed mapping', async () => {
    const fixture = cliTypesFixture();
    const addTypes = fixture.context.onPack;
    fixture.context.onPack = (archive) => {
      addTypes(archive);
      if (archive.manifest.name === 'gt') {
        archive.manifest.exports['./types'].import = './dist/unexpected.js';
      }
    };
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'entrypoints differ from the reviewed manifest'
    );
    expect(publications(fixture)).toHaveLength(0);
  });

  it.each(['main', 'module', 'types', 'bin', 'exports'])(
    'rejects altered packed %s metadata before publishing',
    async (field) => {
      const fixture = releaseFixture();
      fixture.context.onPack = (archive) => {
        if (archive.manifest.name === 'locadex') {
          archive.manifest[field] =
            field === 'exports'
              ? { '.': './dist/unexpected.js' }
              : './dist/unexpected.js';
          archive.entries.push('package/dist/unexpected.js');
        }
      };
      await expect(
        publishRelease({ ...fixture, execute: true })
      ).rejects.toThrow('entrypoints differ from the reviewed manifest');
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it.each(['gtx-cli', 'gt-react'])(
    'does not apply the CLI type-directory mapping to %s',
    async (name) => {
      const fixture = cliTypesFixture(name);
      await expect(publishRelease(fixture)).rejects.toThrow(
        'entrypoint is missing'
      );
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it.each(['index.js', 'index.d.ts'])(
    'rejects a CLI baseline with missing types/%s',
    async (file) => {
      const fixture = cliTypesFixture();
      const addTypes = fixture.context.onPack;
      fixture.context.onPack = (archive) => {
        addTypes(archive);
        archive.entries = archive.entries.filter(
          (entry) => entry !== `package/dist/types/${file}`
        );
      };
      await expect(publishRelease(fixture)).rejects.toThrow(
        'entrypoint is missing'
      );
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it.each(['main', 'other export', 'other condition'])(
    'does not extend the CLI type-directory mapping to %s',
    async (field) => {
      const fixture = cliTypesFixture();
      fixture.context.setManifest('gt', (manifest) => {
        if (field === 'other export') {
          manifest.exports['./other'] = { import: './dist/types.js' };
        } else if (field === 'other condition') {
          manifest.exports['./types'].default = './dist/types.js';
        } else {
          manifest.main = './dist/types.js';
        }
      });
      await expect(publishRelease(fixture)).rejects.toThrow(
        'entrypoint is missing'
      );
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it('rejects an old compiler peer range despite correct runtime dependencies', async () => {
    const fixture = releaseFixture();
    fixture.context.onPack = (archive) => {
      if (archive.manifest.name === 'gt-next') {
        archive.manifest.peerDependencies['@generaltranslation/compiler'] =
          '^1.3.49';
      }
    };
    await expect(publishRelease(fixture)).rejects.toThrow(
      'internal dependency'
    );
  });

  it('aborts when packing dirties a tracked file', async () => {
    const fixture = releaseFixture();
    fixture.context.afterPack = () => {
      fixture.context.dirty = ' M packages/cli/package.json';
    };
    await expect(publishRelease(fixture)).rejects.toThrow('Tracked files');
    expect(publications(fixture)).toHaveLength(0);
  });

  it('aborts if an artifact changes after its manifest was validated', async () => {
    const fixture = releaseFixture();
    fixture.context.onRegistry = () => {
      const tarball = [...fixture.context.archives.keys()][0];
      fixture.context.files.set(tarball, Buffer.from('replaced artifact'));
    };
    await expect(publishRelease(fixture)).rejects.toThrow('tarball changed');
    expect(publications(fixture)).toHaveLength(0);
  });
});

describe('registry preflight and immutable retry behavior', () => {
  it('queries every candidate before the first npm publication and fixes all npm flags', async () => {
    const fixture = releaseFixture();
    fixture.context.beforePublish = () => {
      expect(packs(fixture)).toHaveLength(9);
      const checked = new Set(
        fixture.ops.registry.mock.calls.map(([name]) => name)
      );
      for (const manifest of fixture.context.manifests.values()) {
        expect(checked.has(manifest.name)).toBe(true);
      }
    };
    const before = structuredClone([...fixture.context.metadata]);
    const report = await publishRelease({ ...fixture, execute: true });
    expect(report.published).toHaveLength(9);
    expect(publications(fixture)).toHaveLength(9);
    for (const [, args, options] of publications(fixture)) {
      expect(args).toEqual([
        'publish',
        expect.stringMatching(/\/[^/]+\.tgz$/),
        '--tag',
        'auto-jsx',
        '--access',
        'public',
        '--registry=https://registry.npmjs.org',
        '--ignore-scripts',
        '--provenance',
      ]);
      expect(options.cwd).toBe(report.directory);
    }
    for (const [name, metadata] of before) {
      for (const tag of ['latest', 'bin']) {
        expect(fixture.context.metadata.get(name)['dist-tags']?.[tag]).toBe(
          metadata['dist-tags']?.[tag]
        );
      }
    }
  });

  it('skips identical published artifacts without retagging or publishing', async () => {
    const fixture = releaseFixture();
    fixture.context.afterPack = (archive) => {
      const current = fixture.context.metadata.get(archive.manifest.name);
      current.versions[archive.manifest.version] = {
        ...archive.manifest,
        dist: digest(fixture.context.files.get(archive.tarball)),
      };
    };
    const report = await publishRelease({ ...fixture, execute: true });
    expect(
      report.candidates.every((candidate) => candidate.alreadyPublished)
    ).toBe(true);
    expect(report.published).toEqual([]);
    expect(publications(fixture)).toHaveLength(0);
    for (const current of fixture.context.metadata.values()) {
      expect(current['dist-tags']?.['auto-jsx']).toBeUndefined();
    }
  });

  it('rejects a different artifact already published at the requested version', async () => {
    const fixture = releaseFixture();
    const manifest = fixture.context.manifests.get('locadex');
    fixture.context.metadata.get('locadex').versions[manifest.version] = {
      ...manifest,
      dist: { integrity: 'sha512-other', shasum: 'other' },
    };
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'does not match the verified tarball'
    );
    expect(publications(fixture)).toHaveLength(0);
  });

  it('fails closed if the final package registry lookup fails', async () => {
    const fixture = releaseFixture();
    fixture.context.onRegistry = (name) => {
      if (name === 'locadex') throw new Error('registry unavailable');
    };
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'registry unavailable'
    );
    expect(publications(fixture)).toHaveLength(0);
  });

  it('requires unchanged stable dependency versions to exist on npm', async () => {
    const fixture = releaseFixture();
    fixture.context.metadata.get('generaltranslation').versions = {};
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'stable workspace dependency is not published'
    );
    expect(publications(fixture)).toHaveLength(0);
  });

  it('recovers a transport error only when npm accepted the exact artifact', async () => {
    const fixture = releaseFixture();
    fixture.context.afterPublish = () => {
      throw new Error('connection closed after upload');
    };
    const report = await publishRelease({ ...fixture, execute: true });
    expect(report.published).toHaveLength(9);
    expect(publications(fixture)).toHaveLength(9);
  });

  it('stops after an unsuccessful publication without attempting the next package', async () => {
    const fixture = releaseFixture();
    fixture.context.beforePublish = () => {
      throw new Error('upload rejected');
    };
    await expect(publishRelease({ ...fixture, execute: true })).rejects.toThrow(
      'upload rejected'
    );
    expect(publications(fixture)).toHaveLength(1);
  });

  it.each(['latest', 'bin'])(
    'stops if protected tag %s changes',
    async (tag) => {
      const fixture = releaseFixture();
      fixture.context.afterPublish = (archive) => {
        fixture.context.metadata.get(archive.manifest.name)['dist-tags'][tag] =
          'changed';
      };
      await expect(
        publishRelease({ ...fixture, execute: true })
      ).rejects.toThrow('stable registry tag changed');
      expect(publications(fixture)).toHaveLength(1);
    }
  );
});

describe('Changesets version wrapper', () => {
  it.each([releaseBranch, `changeset-release/${releaseBranch}`])(
    'restores the exact config bytes after versioning on %s',
    async (branch) => {
      const fixture = releaseFixture();
      fixture.context.branch = branch;
      const configPath = path.join(fixture.root, '.changeset/config.json');
      const original = await fixture.ops.read(configPath);
      const unregister = vi.fn();
      const registerRestore = vi.fn(() => unregister);
      await versionPackages({ ...fixture, registerRestore });
      expect(await fixture.ops.read(configPath)).toEqual(original);
      expect(fixture.context.observedConfig).toEqual({
        baseBranch: releaseBranch,
        changelog: '@changesets/cli/changelog',
      });
      expect(registerRestore).toHaveBeenCalledWith(configPath, original);
      expect(unregister).toHaveBeenCalledOnce();
      const statusCall = fixture.ops.run.mock.calls.find(([, args]) =>
        args.includes('status')
      );
      expect(path.isAbsolute(statusCall[1].at(-1))).toBe(false);
    }
  );

  it.each(['status', 'version'])(
    'restores config if the %s command fails',
    async (step) => {
      const fixture = releaseFixture();
      const configPath = path.join(fixture.root, '.changeset/config.json');
      const original = await fixture.ops.read(configPath);
      fixture.context[step === 'status' ? 'onStatus' : 'onVersion'] = () => {
        throw new Error('child failed');
      };
      await expect(versionPackages(fixture)).rejects.toThrow('child failed');
      expect(await fixture.ops.read(configPath)).toEqual(original);
      expect(publications(fixture)).toHaveLength(0);
    }
  );

  it.each(['changeset', 'release'])(
    'rejects an unrelated %s before versioning',
    async (kind) => {
      const fixture = releaseFixture();
      const configPath = path.join(fixture.root, '.changeset/config.json');
      const original = await fixture.ops.read(configPath);
      if (kind === 'changeset') {
        fixture.context.versionPlan.changesets.push({
          id: 'unrelated',
          releases: [{ name: 'generaltranslation', type: 'patch' }],
        });
      } else {
        fixture.context.versionPlan.releases.push({
          name: 'generaltranslation',
          type: 'patch',
          newVersion: '9.2.1-auto-jsx.0',
        });
      }
      await expect(versionPackages(fixture)).rejects.toThrow('outside');
      expect(await fixture.ops.read(configPath)).toEqual(original);
      expect(
        fixture.ops.run.mock.calls.some(([, args]) => args[0] === 'run')
      ).toBe(false);
    }
  );

  it('rejects a stable release plan and restores configuration', async () => {
    const fixture = releaseFixture();
    fixture.context.versionPlan.releases[0].newVersion = '1.3.50';
    await expect(versionPackages(fixture)).rejects.toThrow(
      'outside the experimental channel'
    );
  });

  it('rejects unrelated package version changes produced by a hook', async () => {
    const fixture = releaseFixture();
    fixture.context.onVersion = () => {
      fixture.context.setManifest('generaltranslation', (manifest) => {
        manifest.version = '9.2.1';
      });
    };
    await expect(versionPackages(fixture)).rejects.toThrow(
      'outside the release allowlist'
    );
  });

  it('cannot run from main', async () => {
    const fixture = releaseFixture();
    fixture.context.branch = 'main';
    await expect(versionPackages(fixture)).rejects.toThrow(
      'Versioning requires'
    );
    expect(fixture.context.temporaryDirectories).toBe(0);
  });
});
