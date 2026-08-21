import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));

describe('@generaltranslation/vue-extractor package declarations', () => {
  beforeAll(() => {
    // Turbo builds dependencies before tests. Standalone package tests rebuild
    // so this assertion never inspects stale declarations from another run.
    if (process.env.TURBO_HASH) return;

    const command = process.env.npm_execpath ? process.execPath : 'pnpm';
    const args = process.env.npm_execpath
      ? [process.env.npm_execpath, 'run', 'build']
      : ['run', 'build'];
    execFileSync(command, args, {
      cwd: packageRoot,
      stdio: 'pipe',
      timeout: 60_000,
    });
  }, 65_000);

  it('keeps Vue compiler test types out of the public declaration graph', () => {
    const declarations = [
      'config.d.ts',
      'detect.d.ts',
      'inspect.d.ts',
      'integration.d.ts',
      'index.d.ts',
      'project.d.ts',
      'types.d.ts',
      'internal/extractFromVueSource.d.ts',
    ]
      .map((file) => readFileSync(join(packageRoot, 'dist', file), 'utf8'))
      .join('\n');

    expect(declarations).not.toMatch(/@vue\/compiler-(?:dom|sfc)/);
  });

  it('declares scalar boolean and null rich-wire values recursively', () => {
    const declarations = readFileSync(
      join(packageRoot, 'dist', 'types.d.ts'),
      'utf8'
    );

    expect(declarations).toContain(
      'type VueJsxChildren = VueJsxChild | boolean | null | VueJsxChild[];'
    );
    expect(declarations).toContain('c?: VueJsxChildren;');
    expect(declarations).toContain('b?: Record<string, VueBranchSource>;');
  });

  it('publishes every supported T metadata field', () => {
    const declarations = readFileSync(
      join(packageRoot, 'dist', 'types.d.ts'),
      'utf8'
    );

    const metadataDeclaration = declarations.match(
      /type VueExtractionMetadata = \{[\s\S]*?\n\};/
    )?.[0];
    expect(metadataDeclaration).toContain('context?: string;');
    expect(metadataDeclaration).toContain('id?: string;');
    expect(metadataDeclaration).toContain('maxChars?: number;');
    expect(metadataDeclaration).toContain('requiresReview?: boolean;');
  });

  it('keeps the integration entry lightweight until a handled plan runs', () => {
    const integration = readFileSync(
      join(packageRoot, 'dist', 'integration.js'),
      'utf8'
    );

    expect(integration).not.toMatch(
      /^import .*?(?:fast-glob|\.\/internal\/project|\.\/project\.js)/m
    );
    expect(integration).toContain(
      'import("./internal/project/inspectVueProject.js")'
    );
    expect(integration).toContain('import("./project.js")');
  });
});
