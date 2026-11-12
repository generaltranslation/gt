import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import { handleInitGT } from '../handleInitGT.js';
import { logger } from '../../../console/logger.js';

vi.mock('node:fs', () => ({
  default: { promises: { readFile: vi.fn(), writeFile: vi.fn() } },
}));
vi.mock('../../../console/logger.js', () => ({ logger: { error: vi.fn() } }));

const ESM_IMPORT = 'import { withGTConfig } from "gt-next/config"';
const CJS_REQUIRE =
  'const withGTConfig = require("gt-next/config").withGTConfig';
const CONFIG = 'const nextConfig = {};\nexport default nextConfig;';

type PackageJson = { type?: string };
type TsconfigJson = { compilerOptions?: { module?: string } };

/** Runs handleInitGT on `code` and returns what it wrote and reported. */
async function initGT(
  filepath: string,
  code: string,
  packageJson?: PackageJson,
  tsconfigJson?: TsconfigJson
) {
  vi.mocked(fs.promises.readFile).mockResolvedValue(code);
  const errors: string[] = [];
  const warnings: string[] = [];
  const filesUpdated: string[] = [];
  await handleInitGT(
    filepath,
    errors,
    warnings,
    filesUpdated,
    packageJson,
    tsconfigJson
  );
  const writes = vi.mocked(fs.promises.writeFile).mock.calls;
  return { errors, warnings, filesUpdated, writes, written: writes[0]?.[1] };
}

describe('handleInitGT', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const tsconfig = (module: string) => ({ compilerOptions: { module } });

  // [description, file, code, package.json, tsconfig.json, statement added]
  it.each<[string, string, string, PackageJson?, TsconfigJson?, string?]>([
    [
      'a file with ES imports',
      'next.config.mjs',
      `import { something } from 'other-package';\n${CONFIG}`,
    ],
    [
      'a file with require calls',
      'next.config.js',
      `const other = require('other-module');\nconst nextConfig = {};\nmodule.exports = nextConfig;`,
      { type: 'commonjs' },
      undefined,
      CJS_REQUIRE,
    ],
    [
      'a .js file without package.json',
      'next.config.js',
      CONFIG,
      undefined,
      undefined,
      CJS_REQUIRE,
    ],
    [
      'a .js file in a commonjs package',
      'next.config.js',
      CONFIG,
      { type: 'commonjs' },
      undefined,
      CJS_REQUIRE,
    ],
    [
      'a .js file in a module package',
      'next.config.js',
      CONFIG,
      { type: 'module' },
    ],
    ['a .ts file without tsconfig', 'next.config.ts', CONFIG],
    [
      'a .ts file with module commonjs',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('commonjs'),
      CJS_REQUIRE,
    ],
    [
      'a .ts file with module node',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('node'),
      CJS_REQUIRE,
    ],
    [
      'a .ts file with module esnext',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('esnext'),
    ],
    [
      'a .ts file with module es2022',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('es2022'),
    ],
    [
      'a .ts file with module es6',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('es6'),
    ],
    [
      'a .ts file with module node16',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('node16'),
    ],
    [
      'a .ts file with module nodenext',
      'next.config.ts',
      CONFIG,
      undefined,
      tsconfig('nodenext'),
    ],
    ['a file with another extension', 'next.config.mjs', CONFIG],
  ])(
    'adds the matching import to %s',
    async (
      _name,
      file,
      code,
      packageJson,
      tsconfigJson,
      statement = ESM_IMPORT
    ) => {
      const filepath = `/test/${file}`;

      const result = await initGT(filepath, code, packageJson, tsconfigJson);

      expect(result.writes).toEqual([
        [filepath, expect.stringContaining(statement)],
      ]);
      expect(result.filesUpdated).toEqual([filepath]);
      expect(result.errors).toEqual([]);
    }
  );

  it('warns and uses an ES import when the file mixes import and require', async () => {
    const result = await initGT(
      '/test/next.config.js',
      `import { something } from 'other-package';
       const other = require('other-module');
       ${CONFIG}`
    );

    expect(result.warnings).toContain(
      'Mixed ES6 imports and CommonJS require detected in /test/next.config.js. Defaulting to ES6 imports.'
    );
    expect(result.written).toContain(ESM_IMPORT);
  });

  it.each([
    ['imported', `import { withGTConfig } from 'gt-next/config';`],
    [
      'required by destructuring',
      `const { withGTConfig } = require('gt-next/config');`,
    ],
    [
      'required by member access',
      `const withGTConfig = require('gt-next/config').withGTConfig;`,
    ],
  ])(
    'leaves the file alone when withGTConfig is already %s',
    async (_name, statement) => {
      const result = await initGT(
        '/test/next.config.js',
        `${statement}\nconst nextConfig = {};\nexport default withGTConfig(nextConfig, {});`
      );

      expect(result.writes).toEqual([]);
      expect(result.filesUpdated).toEqual([]);
    }
  );

  it.each([
    ['an identifier', CONFIG, 'export default withGTConfig(nextConfig, {})'],
    [
      'an object literal',
      'export default { reactStrictMode: true };',
      'export default withGTConfig({ reactStrictMode: true }, {})',
    ],
    [
      'a function declaration',
      'export default function nextConfig() { return {}; }',
      'export default withGTConfig(function nextConfig() {return {};}, {})',
    ],
    [
      'a class declaration',
      'export default class NextConfig {}',
      'export default withGTConfig(class NextConfig {}, {})',
    ],
  ])(
    'wraps a default export of %s with withGTConfig',
    async (_name, code, wrapped) => {
      const result = await initGT('/test/next.config.mjs', code);

      expect(result.written).toContain(wrapped);
      expect(result.errors).toEqual([]);
    }
  );

  it('warns and exports an empty function for a TypeScript declare function', async () => {
    const result = await initGT(
      '/test/next.config.ts',
      'export default function nextConfig(): any;'
    );

    expect(result.warnings).toContain(
      'Found TypeScript declare function in /test/next.config.ts. Converting to empty function.'
    );
    expect(result.written).toContain(
      'export default withGTConfig(function nextConfig() {}, {})'
    );
  });

  it('warns about an export that is not an object or a function', async () => {
    const result = await initGT(
      '/test/next.config.js',
      'const nextConfig = "string export";\nexport default nextConfig;'
    );

    expect(result.warnings).toContain(
      'Unexpected export type in /test/next.config.js. Next.js config should export an object or a function returning an object.'
    );
    expect(result.written).toContain(
      'export default withGTConfig(nextConfig, {})'
    );
  });

  it('reports a file that cannot be parsed', async () => {
    const result = await initGT(
      '/test/next.config.js',
      'const nextConfig = {\n  unclosed: {'
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing file /test/next.config.js:')
    );
    expect(result.errors).toEqual([
      expect.stringContaining('Failed to parse /test/next.config.js:'),
    ]);
    expect(result.writes).toEqual([]);
    expect(result.filesUpdated).toEqual([]);
  });
});
