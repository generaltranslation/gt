import {
  channel,
  dependencyFields,
  digest,
  registryUrl,
  requireCondition,
} from './shared.mjs';

function expectedRange(range, version) {
  if (range === 'workspace:*') return version;
  if (range === 'workspace:^') return `^${version}`;
  if (range === 'workspace:~') return `~${version}`;
  return range.replace(/^workspace:/, '');
}

function exportTargets(value, keys) {
  if (typeof value === 'string') return [{ target: value, keys }];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    exportTargets(nested, [...keys, key])
  );
}

export function validatePackedManifest(source, packed, workspace, entries) {
  requireCondition(
    packed.name === source.name &&
      packed.version === source.version &&
      !packed.private,
    'Packed package identity differs from the reviewed manifest',
    source.name
  );
  const publishConfig = packed.publishConfig ?? {};
  requireCondition(
    typeof publishConfig === 'object' &&
      !Array.isArray(publishConfig) &&
      Object.keys(publishConfig).every((key) =>
        ['registry', 'access', 'tag'].includes(key)
      ) &&
      (!publishConfig.registry ||
        [registryUrl, `${registryUrl}/`].includes(publishConfig.registry)) &&
      (!publishConfig.access || publishConfig.access === 'public') &&
      (!publishConfig.tag || publishConfig.tag === channel),
    'Packed publish configuration could override the experimental channel',
    source.name
  );
  for (const field of dependencyFields) {
    const dependencies = packed[field] ?? {};
    requireCondition(
      typeof dependencies === 'object' && !Array.isArray(dependencies),
      'Packed dependencies must be an object',
      `${source.name}: ${field}`
    );
    for (const [name, range] of Object.entries(dependencies)) {
      requireCondition(
        typeof range === 'string' && !/(?:workspace:|file:|link:)/.test(range),
        'Packed dependencies cannot contain local workspace references',
        `${source.name}: ${name}`
      );
      if (!workspace.has(name)) continue;
      const version = workspace.get(name).manifest.version;
      requireCondition(
        [version, `^${version}`, `~${version}`].includes(range) &&
          typeof source[field]?.[name] === 'string' &&
          range === expectedRange(source[field][name], version),
        'A packed internal dependency does not match the reviewed workspace version',
        `${source.name}: ${name}@${range}`
      );
    }
    // pnpm may remove development dependencies from published manifests.
    if (field !== 'devDependencies') {
      for (const name of Object.keys(source[field] ?? {})) {
        requireCondition(
          Object.hasOwn(dependencies, name),
          'A reviewed dependency is missing from the packed manifest',
          `${source.name}: ${name}`
        );
      }
    }
  }
  const required = [
    ...exportTargets(source.main, ['main']),
    ...exportTargets(source.module, ['module']),
    ...exportTargets(source.types, ['types']),
    ...exportTargets(source.bin, ['bin']),
    ...exportTargets(source.exports, ['exports']),
  ].filter(({ target }) => !target.includes('*'));
  for (const { target, keys } of required) {
    // This published export already points at an absent file in the stable
    // baseline. Auto JSX deliberately preserves that existing package mapping.
    if (
      source.name === 'gt-next' &&
      target === './dist/config.mjs' &&
      keys.length === 3 &&
      keys[0] === 'exports' &&
      keys[1] === './config' &&
      keys[2] === 'import'
    ) {
      continue;
    }
    requireCondition(
      !target.split('/').includes('..') &&
        entries.has(`package/${target.replace(/^\.\//, '')}`),
      'A published package entrypoint is missing from its tarball',
      `${source.name}: ${target}`
    );
  }
  requireCondition(
    [...entries].some((entry) => /^package\/dist\/.+\.[cm]?js$/.test(entry)),
    'The tarball does not contain built JavaScript',
    source.name
  );
}

export async function inspectArtifact(ops, tarball, source, workspace) {
  const listing = String(await ops.run('tar', ['-tzf', tarball]));
  const entries = listing.trim().split('\n');
  requireCondition(
    entries.length > 0 &&
      new Set(entries).size === entries.length &&
      entries.every(
        (entry) =>
          entry.startsWith('package/') &&
          !/[\r\\]/.test(entry) &&
          !entry.split('/').includes('..')
      ),
    'The tarball contains duplicate or unsafe paths',
    source.name
  );
  const verbose = String(await ops.run('tar', ['-tvzf', tarball]));
  requireCondition(
    verbose
      .trim()
      .split('\n')
      .every((line) => /^[-d]/.test(line)),
    'The tarball contains a link or unsupported file type',
    source.name
  );
  const packed = JSON.parse(
    String(await ops.run('tar', ['-xOf', tarball, 'package/package.json']))
  );
  validatePackedManifest(source, packed, workspace, new Set(entries));
  if (source.name === 'gt-next') {
    requireCondition(
      entries.includes('package/dist/gt_swc_plugin.wasm'),
      'The Next.js tarball is missing its SWC plugin'
    );
    const wasm = await ops.run(
      'tar',
      ['-xOf', tarball, 'package/dist/gt_swc_plugin.wasm'],
      { binary: true }
    );
    requireCondition(
      wasm.length > 8 &&
        Buffer.from(wasm)
          .subarray(0, 8)
          .equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0])),
      'The Next.js tarball does not contain a valid WASM header'
    );
  }
  return {
    name: source.name,
    version: source.version,
    tarball,
    ...digest(await ops.read(tarball)),
    manifest: packed,
  };
}
