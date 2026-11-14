import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
const INSPECTED_BUILD_OUTPUTS = [
  'config.d.ts',
  'detect.d.ts',
  'inspect.d.ts',
  'integration.d.ts',
  'integration.js',
  'index.d.ts',
  'project.d.ts',
  'types.d.ts',
  'internal/extractFromVueSource.d.ts',
];

describe('@generaltranslation/vue-extractor package layout', () => {
  beforeAll(() => {
    // Turbo builds dependencies before tests. Standalone package tests rebuild
    // only when the inspected output is missing or older than its sources, so
    // these assertions never inspect stale declarations from another run.
    if (process.env.TURBO_HASH || buildIsCurrent()) return;

    // npm_execpath may be a JS CLI (corepack pnpm.cjs, runnable via node) or
    // a native binary (mise-installed pnpm on CI, runnable directly).
    const npmExecpath = process.env.npm_execpath;
    const isJsCli = npmExecpath !== undefined && /\.[cm]?js$/.test(npmExecpath);
    const command = isJsCli ? process.execPath : (npmExecpath ?? 'pnpm');
    const args = isJsCli ? [npmExecpath, 'run', 'build'] : ['run', 'build'];
    execFileSync(command, args, {
      cwd: packageRoot,
      stdio: 'pipe',
      timeout: 60_000,
    });
  }, 65_000);

  it('declares every public package export', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as { exports: Record<string, unknown> };

    expect(Object.keys(packageJson.exports)).toEqual([
      '.',
      './config',
      './detect',
      './inspect',
      './integration',
      './project',
    ]);
  });

  it('contains no source import from the CLI package', () => {
    for (const file of listSourceFiles({ includeTests: true })) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(
        /(?:from\s+|require\s*\()['"][^'"]*(?:packages\/cli|\/cli\/src)/
      );
    }
  });

  it('keeps Vue compiler test types out of the public declaration graph', () => {
    const declarations = INSPECTED_BUILD_OUTPUTS.filter((file) =>
      file.endsWith('.d.ts')
    )
      .map(readBuildOutput)
      .join('\n');

    expect(declarations).not.toMatch(/@vue\/compiler-(?:dom|sfc)/);
  });

  it('declares scalar boolean and null rich-wire values recursively', () => {
    const declarations = readBuildOutput('types.d.ts');

    expect(declarations).toContain(
      'type VueJsxChildren = VueJsxChild | boolean | null | VueJsxChild[];'
    );
    expect(declarations).toContain('c?: VueJsxChildren;');
    expect(declarations).toContain('b?: Record<string, VueBranchSource>;');
  });

  it('publishes every supported T metadata field', () => {
    const metadataDeclaration = readBuildOutput('types.d.ts').match(
      /type VueExtractionMetadata = \{[\s\S]*?\n\};/
    )?.[0];

    expect(metadataDeclaration).toContain('context?: string;');
    expect(metadataDeclaration).toContain('id?: string;');
    expect(metadataDeclaration).toContain('maxChars?: number;');
    expect(metadataDeclaration).toContain('requiresReview?: boolean;');
  });

  it('keeps the integration entry lightweight until a handled plan runs', () => {
    const integration = readBuildOutput('integration.js');

    expect(integration).not.toMatch(
      /^import .*?(?:fast-glob|\.\/internal\/project|\.\/project\.js)/m
    );
    expect(integration).toContain(
      'import("./internal/project/inspectVueProject.js")'
    );
    expect(integration).toContain('import("./project.js")');
  });
});

function readBuildOutput(file: string): string {
  return readFileSync(join(packageRoot, 'dist', file), 'utf8');
}

/** Lists JavaScript and TypeScript files below `src`. */
function listSourceFiles(
  options: { includeTests: boolean },
  directory = join(packageRoot, 'src')
): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' && !options.includeTests
        ? []
        : listSourceFiles(options, file);
    }
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [file] : [];
  });
}

/** Returns whether every inspected build output is newer than its inputs. */
function buildIsCurrent(): boolean {
  const modifiedAt = (file: string) =>
    statSync(file, { throwIfNoEntry: false })?.mtimeMs;
  const outputs = INSPECTED_BUILD_OUTPUTS.map((file) =>
    modifiedAt(join(packageRoot, 'dist', file))
  );
  const inputs = [
    ...listSourceFiles({ includeTests: false }),
    ...[
      'package.json',
      'tsconfig.json',
      'tsdown.config.mts',
      // Shared by every package's build; turbo.json lists both as global
      // dependencies.
      '../../tsdown.preset.mts',
      '../../tsconfig.base.json',
    ].map((file) => join(packageRoot, file)),
  ].map((file) => modifiedAt(file) ?? Infinity);
  const oldestOutput = Math.min(...outputs.map((time) => time ?? -Infinity));
  return oldestOutput >= Math.max(...inputs);
}
