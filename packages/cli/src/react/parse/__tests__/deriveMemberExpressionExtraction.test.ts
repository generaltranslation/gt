import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { hashSource } from 'generaltranslation/id';
import { createInlineUpdates } from '../createInlineUpdates.js';
import type { GTParsingFlags } from '../../../types/parsing.js';
import { Libraries, type GTLibrary } from '../../../types/libraries.js';

/**
 * End-to-end extraction for <Derive> wrapping a member expression, run
 * through the same createInlineUpdates pipeline as `gt generate`, against
 * real files on disk (real import resolution and hashing).
 */

const STEPS_ARRAY = `[
  { label: 'export your reports.' },
  { label: 'invite your team.' },
  { label: 'close the month.' },
  { label: 'pay vendors.' },
  { label: 'track expenses.' },
]`;
const LABELS = [
  'export your reports.',
  'invite your team.',
  'close the month.',
  'pay vendors.',
  'track expenses.',
];

const DEFAULT_FLAGS: GTParsingFlags = {
  autoderive: false,
  includeSourceCodeContext: false,
  enableAutoJsxInjection: false,
  legacyGtReactImportSource: false,
};

let projectDir: string;

beforeEach(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-derive-member-'));
  vi.spyOn(process, 'cwd').mockReturnValue(projectDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(projectDir, { recursive: true, force: true });
});

async function extract(
  files: Record<string, string>,
  opts?: { flags?: Partial<GTParsingFlags>; pkg?: GTLibrary }
) {
  for (const [name, contents] of Object.entries(files)) {
    const filePath = path.join(projectDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, contents);
  }
  return createInlineUpdates(
    opts?.pkg ?? Libraries.GT_NEXT,
    false,
    ['src/**/*.{ts,tsx}'],
    { ...DEFAULT_FLAGS, ...opts?.flags },
    { conditionNames: ['browser', 'module', 'import', 'require', 'default'] }
  );
}

function stepHeading(child: string, { pkg = 'gt-next', setup = '' } = {}) {
  return `
    import { T, Derive } from '${pkg}';
    import { steps } from './steps';

    export function StepHeading({ index }: { index: number }) {
      ${setup}
      return (
        <T>
          <h3>Learn to</h3>
          <div><Derive>{${child}}</Derive></div>
        </T>
      );
    }
  `;
}

const STEPS_MODULE = { 'src/steps.ts': `export const steps = ${STEPS_ARRAY};` };

function expectedSource(label: string) {
  return [
    { t: 'h3', i: 1, c: 'Learn to' },
    { t: 'div', i: 2, c: { t: 'Derive', i: 3, c: label } },
  ];
}

describe('gt generate: <Derive> with a direct member expression', () => {
  it('extracts one complete entry per array element with stable hashes', async () => {
    const result = await extract({
      ...STEPS_MODULE,
      'src/StepHeading.tsx': stepHeading('steps[index].label'),
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.updates.map((u) => u.source)).toEqual(
      LABELS.map(expectedSource)
    );
    for (const update of result.updates) {
      expect(update.dataFormat).toBe('JSX');
      expect(update.metadata.hash).toBe(
        hashSource({ source: update.source, dataFormat: 'JSX' })
      );
    }
    // All variants of one <T> are linked under a single shared id
    const staticIds = new Set(result.updates.map((u) => u.metadata.staticId));
    expect(staticIds.size).toBe(1);
    expect([...staticIds][0]).not.toMatch(/^derive-temp-id-/);
  });

  it('matches the local-alias workaround exactly', async () => {
    const direct = await extract({
      ...STEPS_MODULE,
      'src/StepHeading.tsx': stepHeading('steps[index].label'),
    });
    fs.rmSync(path.join(projectDir, 'src'), { recursive: true });
    const alias = await extract({
      ...STEPS_MODULE,
      'src/StepHeading.tsx': stepHeading('label', {
        setup: 'const label = steps[index].label;',
      }),
    });

    expect(alias.errors).toEqual([]);
    const summarize = (updates: typeof direct.updates) =>
      updates.map((u) => ({
        source: u.source,
        hash: u.metadata.hash,
        staticId: u.metadata.staticId,
      }));
    expect(summarize(direct.updates)).toEqual(summarize(alias.updates));
  });

  it('extracts the same values as the derive() string API', async () => {
    const result = await extract({
      ...STEPS_MODULE,
      'src/StepHeading.tsx': `
        import { T, Derive, useGT, derive } from 'gt-next';
        import { steps } from './steps';

        export function StepHeading({ index }: { index: number }) {
          const gt = useGT();
          return (
            <>
              <T>Learn to <Derive>{steps[index].label}</Derive></T>
              <p>{gt(\`Learn to \${derive(steps[index].label)}\`)}</p>
            </>
          );
        }
      `,
    });

    expect(result.errors).toEqual([]);
    const jsxValues = result.updates
      .filter((u) => u.dataFormat === 'JSX')
      .map((u) => {
        const [prefix, derive] = u.source as [string, { c: string }];
        return prefix + derive.c;
      });
    const stringValues = result.updates
      .filter((u) => u.dataFormat !== 'JSX')
      .map((u) => u.source);
    const expected = LABELS.map((label) => `Learn to ${label}`);
    expect(jsxValues).toEqual(expected);
    expect(stringValues).toEqual(expected);
  });

  it('resolves an array re-exported through a barrel file', async () => {
    const result = await extract({
      'src/data/steps.ts': `export const steps = ${STEPS_ARRAY} as const;`,
      'src/data/index.ts': `export * from './steps';`,
      'src/StepHeading.tsx': stepHeading('steps[index].label').replace(
        "from './steps'",
        "from './data'"
      ),
    });

    expect(result.errors).toEqual([]);
    expect(result.updates.map((u) => u.source)).toEqual(
      LABELS.map(expectedSource)
    );
  });

  it('extracts the same entries for gt-react', async () => {
    const result = await extract(
      {
        ...STEPS_MODULE,
        'src/StepHeading.tsx': stepHeading('steps[index].label', {
          pkg: 'gt-react',
        }),
      },
      { pkg: Libraries.GT_REACT }
    );

    expect(result.errors).toEqual([]);
    expect(result.updates.map((u) => u.source)).toEqual(
      LABELS.map(expectedSource)
    );
  });

  it('extracts with enableAutoJsxInjection when <T> is not written', async () => {
    const files = (child: string, setup = '') => ({
      ...STEPS_MODULE,
      'src/StepHeading.tsx': `
        import { Derive } from 'gt-next';
        import { steps } from './steps';

        export function StepHeading({ index }: { index: number }) {
          ${setup}
          return <p>Learn to <Derive>{${child}}</Derive></p>;
        }
      `,
    });
    const flags = { enableAutoJsxInjection: true };
    const direct = await extract(files('steps[index].label'), { flags });
    fs.rmSync(path.join(projectDir, 'src'), { recursive: true });
    const alias = await extract(
      files('label', 'const label = steps[index].label;'),
      { flags }
    );

    expect(direct.errors).toEqual([]);
    expect(direct.updates).toHaveLength(LABELS.length);
    expect(direct.updates.map((u) => u.metadata.hash)).toEqual(
      alias.updates.map((u) => u.metadata.hash)
    );
  });

  it('extracts a bare member expression with autoderive', async () => {
    const result = await extract(
      {
        ...STEPS_MODULE,
        'src/StepHeading.tsx': `
          import { T } from 'gt-next';
          import { steps } from './steps';

          export function StepHeading({ index }: { index: number }) {
            return <T>Learn to {steps[index].label}</T>;
          }
        `,
      },
      { flags: { autoderive: true } }
    );

    expect(result.errors).toEqual([]);
    expect(result.updates.map((u) => u.source)).toEqual(
      LABELS.map((label) => ['Learn to ', label])
    );
  });

  it('still fails extraction for a value that is only known at runtime', async () => {
    const result = await extract({
      'src/StepHeading.tsx': `
        import { T, Derive } from 'gt-next';

        export function StepHeading({ step }: { step: { label: string } }) {
          return <T>Learn to <Derive>{step.label}</Derive></T>;
        }
      `,
    });

    expect(result.updates).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('could change at runtime');
    expect(result.errors[0]).toContain('step.label');
  });
});
