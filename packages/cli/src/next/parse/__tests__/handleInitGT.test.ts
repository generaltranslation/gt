import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { handleInitGT } from '../handleInitGT.js';
import { logError } from '../../../console/logging.js';

// Mock dependencies
vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  },
}));

vi.mock('../../../console/logging.js', () => ({
  logError: vi.fn(),
}));

describe('handleInitGT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  // Common test data factories
  const createMockPackageJson = (
    overrides: Partial<{ type?: string }> = {}
  ) => ({
    type: 'module',
    ...overrides,
  });

  const createMockTsConfigJson = (
    overrides: Partial<{ compilerOptions?: { module?: string } }> = {}
  ) => ({
    compilerOptions: {
      module: 'esnext',
      ...overrides.compilerOptions,
    },
    ...overrides,
  });

  const createTestArrays = () => ({
    errors: [] as string[],
    warnings: [] as string[],
    filesUpdated: [] as string[],
  });

  describe('ES6 imports detection', () => {
    it('should add ES6 import when file uses ES6 imports', async () => {
      const filepath = '/test/next.config.mjs';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson({ type: 'module' });

      const code = `
import { something } from 'other-package';

const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
      expect(filesUpdated).toContain(filepath);
      expect(errors).toHaveLength(0);
      // May have warnings, so don't assert warnings length
    });

    it('should add CommonJS require when file uses CommonJS require', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson({ type: 'commonjs' });

      const code = `
const someOtherModule = require('other-module');

const nextConfig = {
  // config here
};

module.exports = nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'const withGTConfig = require("gt-next/config").withGTConfig'
        )
      );
      expect(filesUpdated).toContain(filepath);
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it('should warn and default to ES6 imports when mixed imports detected', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
import { something } from 'other-package';
const someOtherModule = require('other-module');

const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(warnings).toContain(
        'Mixed ES6 imports and CommonJS require detected in /test/next.config.js. Defaulting to ES6 imports.'
      );
      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });
  });

  describe('TypeScript configuration detection', () => {
    it('should use CommonJS for TypeScript files with commonjs module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'commonjs' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'const withGTConfig = require("gt-next/config").withGTConfig'
        )
      );
    });

    it('should use ES6 imports for TypeScript files with esnext module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'esnext' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });
  });

  describe('JavaScript file type detection', () => {
    it('should use CommonJS for .js files when package.json type is not module', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson({ type: 'commonjs' });

      const code = `
const nextConfig = {
  // config here
};

module.exports = nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'const withGTConfig = require("gt-next/config").withGTConfig'
        )
      );
    });

    it('should use ES6 imports for .js files when package.json type is module', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson({ type: 'module' });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });
  });

  describe('existing imports detection', () => {
    it('should not add import if withGTConfig is already imported', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
import { withGTConfig } from 'gt-next/config';

const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).not.toHaveBeenCalled();
      expect(filesUpdated).toHaveLength(0);
    });

    it('should not add import if initGT is already imported', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
import { initGT } from 'gt-next/config';

const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).not.toHaveBeenCalled();
      expect(filesUpdated).toHaveLength(0);
    });

    it('should not add import if withGTConfig is already required (destructuring)', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
const { withGTConfig } = require('gt-next/config');

const nextConfig = {
  // config here
};

module.exports = withGTConfig(nextConfig, {});
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).not.toHaveBeenCalled();
      expect(filesUpdated).toHaveLength(0);
    });

    it('should not add import if withGTConfig is already required (member access)', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
const withGTConfig = require('gt-next/config').withGTConfig;

const nextConfig = {
  // config here
};

module.exports = withGTConfig(nextConfig, {});
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).not.toHaveBeenCalled();
      expect(filesUpdated).toHaveLength(0);
    });
  });

  describe('export transformation', () => {
    it('should wrap function declaration export with withGTConfig', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
function nextConfig() {
  return {
    // config here
  };
}

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('export default withGTConfig(nextConfig, {})')
      );
    });

    it('should wrap class declaration export with withGTConfig', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
class NextConfig {
  constructor() {
    // config here
  }
}

export default NextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('export default withGTConfig(NextConfig, {})')
      );
    });

    it('should wrap object export with withGTConfig', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('export default withGTConfig(nextConfig, {})')
      );
    });

    it('should warn and convert TypeScript declare function to empty function', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
export default function nextConfig(): any;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(warnings).toContain(
        'Found TypeScript declare function in /test/next.config.ts. Converting to empty function.'
      );
      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'export default withGTConfig(function nextConfig() {}, {})'
        )
      );
    });

    it('should warn for unexpected export types', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
const nextConfig = "string export";

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(warnings).toContain(
        'Unexpected export type in /test/next.config.js. Next.js config should export an object or a function returning an object.'
      );
      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('export default withGTConfig(nextConfig, {})')
      );
    });
  });

  describe('error handling', () => {
    it('should handle parsing errors', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const invalidCode = `
const nextConfig = {
  // invalid syntax
  unclosed: {
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(invalidCode);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing file /test/next.config.js:')
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Failed to parse /test/next.config.js:');
      expect(filesUpdated).toHaveLength(0);
    });
  });

  describe('configuration fallback when no imports detected', () => {
    it('should use CommonJS for .js files when no package.json provided', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'const withGTConfig = require("gt-next/config").withGTConfig'
        )
      );
    });

    it('should use ES6 imports for .js files when package.json type is module', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson({ type: 'module' });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });

    it('should use CommonJS for .js files when package.json type is not module', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson({ type: 'commonjs' });

      const code = `
const nextConfig = {
  // config here
};

module.exports = nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'const withGTConfig = require("gt-next/config").withGTConfig'
        )
      );
    });

    it('should default to ES6 imports for .ts files when no tsconfig provided', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });

    it('should use CommonJS for .ts files with node module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'node' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining(
          'const withGTConfig = require("gt-next/config").withGTConfig'
        )
      );
    });

    it('should use ES6 imports for .ts files with es2022 module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'es2022' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });

    it('should use ES6 imports for .ts files with node16 module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'node16' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });

    it('should use ES6 imports for .ts files with es6 module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'es6' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });

    it('should use ES6 imports for .ts files with nodenext module setting', async () => {
      const filepath = '/test/next.config.ts';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const tsconfigJson = createMockTsConfigJson({
        compilerOptions: { module: 'nodenext' },
      });

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(
        filepath,
        errors,
        warnings,
        filesUpdated,
        undefined,
        tsconfigJson
      );

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });

    it('should default to ES6 imports for other file extensions', async () => {
      const filepath = '/test/next.config.mjs';
      const { errors, warnings, filesUpdated } = createTestArrays();

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated);

      expect(vi.mocked(fs.promises.writeFile)).toHaveBeenCalledWith(
        filepath,
        expect.stringContaining('import { withGTConfig } from "gt-next/config"')
      );
    });
  });

  describe('file mutation tracking', () => {
    it('should add filepath to filesUpdated array when file is modified', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
const nextConfig = {
  // config here
};

export default nextConfig;
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(filesUpdated).toContain(filepath);
      expect(filesUpdated).toHaveLength(1);
    });

    it('should not add filepath to filesUpdated array when no changes made', async () => {
      const filepath = '/test/next.config.js';
      const { errors, warnings, filesUpdated } = createTestArrays();
      const packageJson = createMockPackageJson();

      const code = `
import { withGTConfig } from 'gt-next/config';

const nextConfig = {
  // config here
};

export default withGTConfig(nextConfig, {});
`;

      vi.mocked(fs.promises.readFile).mockResolvedValue(code);
      vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);

      await handleInitGT(filepath, errors, warnings, filesUpdated, packageJson);

      expect(filesUpdated).toHaveLength(0);
    });
  });
});
