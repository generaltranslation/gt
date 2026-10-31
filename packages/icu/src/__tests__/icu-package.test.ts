import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const parserMarker = 'UNMATCHED_CLOSING_TAG';
const extensions = ['mjs', 'cjs'] as const;

function modifiedAt(file: string): number {
  try {
    return statSync(file).mtimeMs;
  } catch {
    return Number.NaN;
  }
}

// Turbo builds before testing; a direct vitest run may find an older build.
function hasCurrentBuild(): boolean {
  const built = extensions.flatMap((extension) =>
    ['index', 'parser', 'convert'].map((entry) =>
      modifiedAt(join(packageRoot, 'dist', `${entry}.${extension}`))
    )
  );
  const sources = [
    'package.json',
    'tsdown.config.mts',
    ...readdirSync(join(packageRoot, 'src'), { recursive: true })
      .map(String)
      .filter((file) => !file.includes('__tests__'))
      .map((file) => join('src', file)),
  ].map((file) => modifiedAt(join(packageRoot, file)));
  const oldestBuild = Math.min(...built);
  return (
    !Number.isNaN(oldestBuild) &&
    sources.every((time) => Number.isNaN(time) || time <= oldestBuild)
  );
}

function buildPackage(): void {
  // npm_execpath may be a JS CLI (corepack pnpm.cjs, runnable via node) or
  // a native binary (mise-installed pnpm on CI, runnable directly).
  const npmExecpath = process.env.npm_execpath;
  const isJsCli = npmExecpath !== undefined && /\.[cm]?js$/.test(npmExecpath);
  const command = isJsCli ? process.execPath : (npmExecpath ?? 'pnpm');
  const args = isJsCli ? [npmExecpath, 'run', 'build'] : ['run', 'build'];
  execFileSync(command, args, { cwd: packageRoot, stdio: 'pipe' });
}

// The entry plus every relative chunk it loads.
function bundledCode(file: string, seen = new Set<string>()): string {
  if (seen.has(file)) return '';
  seen.add(file);
  const code = readFileSync(file, 'utf8');
  const chunks = [
    ...code.matchAll(/(?:from|require\()\s*["'](\.[^"']+)["']/g),
  ].map((match) => bundledCode(resolve(dirname(file), match[1]), seen));
  return code + chunks.join('');
}

describe('@generaltranslation/icu package artifacts', () => {
  beforeAll(() => {
    if (!hasCurrentBuild()) buildPackage();
  });

  it.each(extensions)('keeps the parser out of the root %s entry', (ext) => {
    const root = bundledCode(join(packageRoot, 'dist', `index.${ext}`));
    const parser = bundledCode(join(packageRoot, 'dist', `parser.${ext}`));
    expect(root).not.toContain(parserMarker);
    expect(parser).toContain(parserMarker);
  });

  it('loads the root and parser entrypoints from both formats', () => {
    const smoke = `
      const assert = require('node:assert/strict');
      const root = LOAD('@generaltranslation/icu');
      const parser = LOAD('@generaltranslation/icu/parser');
      assert.equal(root.parse, undefined);
      assert.equal(parser.formatMessage('Hi {name}', 'en', { name: 'Ada' }), 'Hi Ada');
      const convert = LOAD('@generaltranslation/icu/convert');
      assert.equal(parser.toMessageTree, undefined);
      assert.equal(root.formatMessageTree(convert.icuToMessageTree('Hi {name}'), 'en', { name: 'Ada' }), 'Hi Ada');
      assert.equal(convert.messageTreeToIcu(root.buildMessageTree(['Hi ', ''], [{ kind: 'argument', name: 'name' }]).tree), 'Hi {name}');
    `;
    for (const esm of [true, false]) {
      const script = esm
        ? `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url); ${smoke.replaceAll('LOAD(', 'await import(')}`
        : smoke.replaceAll('LOAD(', 'require(');
      execFileSync(
        process.execPath,
        [...(esm ? ['--input-type=module'] : []), '--eval', script],
        { cwd: packageRoot, stdio: 'pipe' }
      );
    }
  });
});
