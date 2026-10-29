import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import {
  getStringVariants,
  isPlainValue,
  loadTypeScript,
} from '../typeChecker.js';

const traverse = traverseModule.default || traverseModule;

const STRICT = JSON.stringify({ compilerOptions: { strict: true } });
const PREAMBLE = `
declare function derive(value: unknown): string;
declare const flag: boolean;
declare const text: string;
`;

// TypeScript 7.1 has a different compiler API; projects that link it use it.
const NATIVE_TYPESCRIPT = path.dirname(
  createRequire(import.meta.url).resolve('typescript-native/package.json')
);

let testDir: string | undefined;
let linkedTypeScript: string | undefined;

afterEach(() => {
  if (testDir) fs.rmSync(testDir, { recursive: true, force: true });
  testDir = undefined;
});

/** Writes the files to a fresh directory and returns its path. */
function createProject(files: Record<string, string>): string {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-type-checker-'));
  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(testDir, name);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }
  if (linkedTypeScript) {
    fs.mkdirSync(path.join(testDir, 'node_modules'));
    fs.symlinkSync(
      linkedTypeScript,
      path.join(testDir, 'node_modules', 'typescript'),
      'dir'
    );
  }
  return testDir;
}

/** Resolves the argument of every derive() call, at the offsets Babel gives it. */
async function deriveVariants(file: string) {
  await loadTypeScript(file);
  const ast = parse(fs.readFileSync(file, 'utf8'), {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  const results: ReturnType<typeof getStringVariants>[] = [];
  traverse(ast, {
    CallExpression(callPath) {
      const [argument] = callPath.node.arguments;
      if (t.isIdentifier(callPath.node.callee, { name: 'derive' })) {
        results.push(getStringVariants(file, argument.start!, argument.end!));
      }
    },
  });
  return results;
}

async function variantsOf(body: string, files: Record<string, string> = {}) {
  const root = createProject({
    'tsconfig.json': STRICT,
    'app.ts': PREAMBLE + body,
    ...files,
  });
  return deriveVariants(path.join(root, 'app.ts'));
}

describe.each([
  ['the CLI peer TypeScript', undefined],
  ['TypeScript 7.1', NATIVE_TYPESCRIPT],
])('getStringVariants with %s', (_name, typescript) => {
  beforeEach(() => {
    linkedTypeScript = typescript;
  });
  afterEach(() => {
    linkedTypeScript = undefined;
  });

  it.each([
    ['a conditional', "derive(flag ? 'day' : 'night');"],
    ['a parenthesized conditional', "derive((flag ? 'day' : 'night'));"],
    [
      'a helper that returns literals',
      "function f() { return flag ? 'day' : 'night'; }\nderive(f());",
    ],
    [
      'a switch helper',
      "function f(n: 1 | 2) { switch (n) { case 1: return 'day'; default: return 'night'; } }\nderive(f(1));",
    ],
    [
      'a union-typed value',
      "declare const time: 'day' | 'night';\nderive(time);",
    ],
    [
      'a string enum',
      "enum Time { Day = 'day', Night = 'night' }\ndeclare const time: Time;\nderive(time);",
    ],
    [
      'an as const lookup',
      "const labels = { a: 'day', b: 'night' } as const;\ndeclare const key: 'a' | 'b';\nderive(labels[key]);",
    ],
  ])('reads %s', async (_name, body) => {
    expect(await variantsOf(body)).toEqual([{ variants: ['day', 'night'] }]);
  });

  it('reads a helper imported from another file', async () => {
    const results = await variantsOf(
      "import { label } from './labels';\nderive(label());",
      {
        'labels.ts':
          "declare const flag: boolean;\nexport function label() { return flag ? 'day' : 'night'; }",
      }
    );
    expect(results).toEqual([{ variants: ['day', 'night'] }]);
  });

  it.each([
    ['a string', 'derive(text);'],
    [
      'a helper that returns one widened literal',
      "function f() { return 'day'; }\nderive(f());",
    ],
    [
      'a lookup typed as Record<string>',
      "const labels: Record<'a' | 'b', string> = { a: 'day', b: 'night' };\ndeclare const key: 'a' | 'b';\nderive(labels[key]);",
    ],
    ['a template pattern', 'derive(`id-${text}` as const);'],
    ['a union with a string', "derive(flag ? 'day' : text);"],
  ])('reports %s as open', async (_name, body) => {
    expect(await variantsOf(body)).toEqual([{ issue: 'open' }]);
  });

  it('reports numbers as non-string', async () => {
    expect(await variantsOf('derive(flag ? 1 : 2);')).toEqual([
      { issue: 'non-string' },
    ]);
  });

  it('finds the app config behind a solution-style tsconfig', async () => {
    // The alias only exists in tsconfig.app.json, so the import resolves only
    // if that config is used.
    const root = createProject({
      'tsconfig.json': JSON.stringify({
        files: [],
        references: [{ path: './tsconfig.app.json' }],
      }),
      'tsconfig.app.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          composite: true,
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
        include: ['src'],
      }),
      'src/labels.ts': "export const labels = ['day', 'night'] as const;",
      'src/app.ts': `${PREAMBLE}import { labels } from '@/labels';\nderive(labels[0]);`,
    });
    expect(await deriveVariants(path.join(root, 'src/app.ts'))).toEqual([
      { variants: ['day'] },
    ]);
  });

  it('reads a JavaScript file without a tsconfig', async () => {
    const root = createProject({
      'app.js':
        "function derive(value) { return value; }\nfunction f(flag) { return flag ? 'day' : 'night'; }\nderive(f(true));",
    });
    expect(await deriveVariants(path.join(root, 'app.js'))).toEqual([
      { variants: ['day', 'night'] },
    ]);
  });

  it('reads a JavaScript file in a project without allowJs', async () => {
    const root = createProject({
      'tsconfig.json': STRICT,
      'app.js':
        "function derive(value) { return value; }\nfunction f(flag) { return flag ? 'day' : 'night'; }\nderive(f(true));",
    });
    expect(await deriveVariants(path.join(root, 'app.js'))).toEqual(
      typescript
        ? // TypeScript 7.1.0-beta's compiler process panics opening this file.
          [{ issue: 'typescript-error' }]
        : [{ variants: ['day', 'night'] }]
    );
  });
});

describe.each([
  ['the CLI peer TypeScript', undefined],
  ['TypeScript 7.1', NATIVE_TYPESCRIPT],
])('isPlainValue with %s', (_name, typescript) => {
  beforeEach(() => {
    linkedTypeScript = typescript;
  });
  afterEach(() => {
    linkedTypeScript = undefined;
  });

  /** Whether `value` in `t(value)` is a plain value. */
  async function plainOf(declarations: string) {
    const root = createProject({
      'tsconfig.json': STRICT,
      // An unclosed generic function is still typed, with `value` inside it.
      'app.ts': `declare function t(value: unknown): void;\n${declarations}\nt(value);`,
    });
    const file = path.join(root, 'app.ts');
    const start = fs.readFileSync(file, 'utf8').lastIndexOf('value');
    await loadTypeScript(file);
    return isPlainValue(file, start, start + 'value'.length);
  }

  it.each([
    ['a string', 'declare const value: string;'],
    ['a number or null', 'declare const value: number | null;'],
    ['a Date', 'declare const value: Date;'],
    ['a template literal type', 'declare const value: `id-${string}`;'],
    ['a branded string', "declare const value: string & { brand: 'id' };"],
    [
      'a type parameter constrained to string',
      'function g<T extends string>(value: T) {',
    ],
  ])('reads %s as plain', async (_case, declarations) => {
    expect(await plainOf(declarations)).toBe(true);
  });

  it.each([
    ['an object', 'declare const value: { name: string };'],
    ['a unique symbol', 'declare const value: unique symbol;'],
    ['a string or an object', 'declare const value: string | { a: 1 };'],
  ])('reads %s as not plain', async (_case, declarations) => {
    expect(await plainOf(declarations)).toBe(false);
  });
});

it('reports TypeScript 7.0, which has no compiler API, as unsupported', async () => {
  const root = createProject({
    'node_modules/typescript/package.json': JSON.stringify({
      name: 'typescript',
      version: '7.0.2',
      main: 'version.cjs',
    }),
    'node_modules/typescript/version.cjs':
      "module.exports = { version: '7.0.2', versionMajorMinor: '7.0' };",
    'app.ts': `${PREAMBLE}derive(flag ? 'day' : 'night');`,
  });
  expect(await deriveVariants(path.join(root, 'app.ts'))).toEqual([
    { issue: 'unsupported-typescript' },
  ]);
});
