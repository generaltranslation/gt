import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  expectedVersionsFromPlan,
  inspectConsumer,
  parseConsumerArguments,
  runConsumerSmoke,
  verifyHashOutput,
} from './consumer-smoke.mjs';
import { releasePackages } from './shared.mjs';

const versions = Object.fromEntries(
  Object.keys(releasePackages).map((name) => [name, '1.0.0-auto-jsx.0'])
);

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value));
}

async function fixture() {
  // Retain all fixtures, including failed process reports, for inspection.
  const consumer = await fs.mkdtemp(
    path.join(os.tmpdir(), 'gt-release-consumer-test-')
  );
  await writeJson(path.join(consumer, 'package.json'), { private: true });
  for (const [name, version] of Object.entries(versions)) {
    await writeJson(path.join(consumer, 'node_modules', name, 'package.json'), {
      name,
      version,
      ...(name === 'gt' && { bin: 'bin/main.cjs' }),
    });
  }
  return consumer;
}

describe('consumer smoke input contract', () => {
  it('accepts the existing release plan and an explicit version map', () => {
    expect(expectedVersionsFromPlan(versions)).toEqual(versions);
    expect(
      expectedVersionsFromPlan({
        expectedSha: 'a'.repeat(40),
        candidates: Object.entries(versions).map(([name, version]) => ({
          name,
          version,
          tarball: `${name}.tgz`,
        })),
      })
    ).toEqual(versions);
  });

  it.each([
    null,
    [],
    {},
    { ...versions, gt: '1.0.0' },
    { ...versions, gt: '1.0.0-auto-jsx.0 || latest' },
    { ...versions, gt: '1.0.0-auto-jsx.0\n' },
    { ...versions, unrelated: '1.0.0-auto-jsx.0' },
    {
      candidates: Object.keys(versions).map(() => ({
        name: 'gt',
        version: '1.0.0-auto-jsx.0',
      })),
    },
  ])(
    'rejects incomplete, duplicate, or non-channel version plans: %j',
    (plan) => {
      expect(() => expectedVersionsFromPlan(plan)).toThrow(
        'all nine auto-jsx packages'
      );
    }
  );

  it('parses explicit consumer paths without interpreting shell syntax', () => {
    expect(
      parseConsumerArguments([
        '--consumer',
        '/tmp/a consumer $(literal)',
        '--plan',
        '/tmp/plan.json',
        '--host',
        'next',
        '--report',
        '/tmp/report.json',
      ])
    ).toEqual({
      consumer: '/tmp/a consumer $(literal)',
      plan: '/tmp/plan.json',
      host: 'next',
      report: '/tmp/report.json',
    });
  });

  it.each([
    [],
    ['--consumer', '/tmp/project'],
    ['--consumer', '/tmp/project', '--plan'],
    [
      '--consumer',
      '/tmp/project',
      '--plan',
      '/tmp/p',
      '--consumer',
      '/tmp/other',
    ],
    ['--consumer', '/tmp/project', '--plan', '/tmp/p', '--host', 'unknown'],
    ['--consumer', '/tmp/project', '--plan', '/tmp/p', '--execute'],
  ])('rejects invalid command arguments: %j', (args) => {
    expect(() => parseConsumerArguments(args)).toThrow();
  });
});

describe('installed consumer isolation', () => {
  it('verifies package identities and versions without requiring a root export', async () => {
    const consumer = await fixture();
    const packages = await inspectConsumer(consumer, versions);
    expect(Object.keys(packages)).toHaveLength(9);
    expect(packages['@generaltranslation/react-core'].version).toBe(
      versions['@generaltranslation/react-core']
    );
  });

  it('rejects stale installed versions', async () => {
    const consumer = await fixture();
    await writeJson(path.join(consumer, 'node_modules/gt/package.json'), {
      name: 'gt',
      version: '0.9.0',
    });
    await expect(inspectConsumer(consumer, versions)).rejects.toThrow(
      'does not match the release plan'
    );
  });

  it('rejects a package with the wrong declared identity', async () => {
    const consumer = await fixture();
    await writeJson(path.join(consumer, 'node_modules/gt/package.json'), {
      name: 'other',
      version: versions.gt,
    });
    await expect(inspectConsumer(consumer, versions)).rejects.toThrow(
      'unexpected package identity'
    );
  });

  it('does not fall back to packages installed in an ancestor', async () => {
    const ancestor = await fixture();
    const consumer = path.join(ancestor, 'nested-consumer');
    await writeJson(path.join(consumer, 'package.json'), { private: true });
    await expect(inspectConsumer(consumer, versions)).rejects.toThrow(
      'missing from the consumer installation'
    );
  });

  it('rejects a nested stale compiler even when the top-level version is correct', async () => {
    const consumer = await fixture();
    const next = path.join(consumer, 'node_modules/gt-next');
    await writeJson(path.join(next, 'package.json'), {
      name: 'gt-next',
      version: versions['gt-next'],
      peerDependencies: { '@generaltranslation/compiler': '^0.9.0' },
    });
    await writeJson(
      path.join(next, 'node_modules/@generaltranslation/compiler/package.json'),
      {
        name: '@generaltranslation/compiler',
        version: '0.9.0',
      }
    );
    await expect(inspectConsumer(consumer, versions)).rejects.toThrow(
      'different prerelease dependency'
    );
  });

  it('runs the public CLI in an empty directory and retains failures', async () => {
    const consumer = await fixture();
    const bin = path.join(consumer, 'node_modules/gt/bin/main.cjs');
    await fs.mkdir(path.dirname(bin), { recursive: true });
    await fs.writeFile(
      bin,
      `
      const assert = require('node:assert/strict');
      const fs = require('node:fs');
      assert.deepEqual(process.argv.slice(2), ['--version']);
      assert.deepEqual(fs.readdirSync(process.cwd()), []);
      assert.equal(process.env.NODE_OPTIONS, undefined);
      process.stdout.write('stale-generated-version\\n');
    `
    );
    const report = path.join(consumer, 'failed-report.json');
    await expect(
      runConsumerSmoke({ consumer, expectedVersions: versions, report })
    ).rejects.toThrow('does not report its reviewed package version');
    const result = JSON.parse(await fs.readFile(report, 'utf8'));
    expect(result.status).toBe('failed');
    expect(Object.keys(result.packages)).toHaveLength(9);
    expect(result.directory).toContain('auto-jsx-consumer-smoke-');
    expect(await fs.readdir(result.directory)).toEqual([]);
  });
});

describe('manual-hash verification', () => {
  const hash = '0123456789abcdef';
  const textProperty = {
    type: 'ObjectProperty',
    key: { type: 'Identifier', name: 'children' },
    value: { type: 'StringLiteral', value: 'Hello world' },
  };
  const hashProperty = {
    type: 'ObjectProperty',
    key: { type: 'Identifier', name: '_hash' },
    value: { type: 'StringLiteral', value: hash },
  };
  const program = (properties) => ({
    type: 'Program',
    body: [{ type: 'ObjectExpression', properties }],
  });
  const original = program([textProperty]);

  function compare(after, expected = [hash]) {
    return verifyHashOutput(
      (source) => structuredClone(source === 'before' ? original : after),
      'before',
      'after',
      expected
    );
  }

  it('permits only added hash properties and parser source positions', () => {
    const after = {
      ...program([hashProperty, textProperty]),
      start: 10,
      end: 20,
      loc: { line: 1 },
    };
    expect(compare(after).hashes).toEqual([hash]);
  });

  it('rejects absent or wrong hashes', () => {
    expect(() => compare(original)).toThrow('do not match');
    expect(() =>
      compare(program([hashProperty, textProperty]), ['fedcba9876543210'])
    ).toThrow('do not match');
  });

  it('rejects empty hashes and unexpected syntax changes', () => {
    expect(() =>
      compare(
        program([
          { ...hashProperty, value: { type: 'StringLiteral', value: '' } },
          textProperty,
        ])
      )
    ).toThrow('not a valid literal');
    expect(() =>
      compare(
        program([
          hashProperty,
          {
            ...textProperty,
            value: { type: 'StringLiteral', value: 'Changed' },
          },
        ])
      )
    ).toThrow('changed more than');
  });
});
