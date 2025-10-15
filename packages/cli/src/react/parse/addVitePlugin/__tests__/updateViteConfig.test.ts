/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parse } from '@babel/parser';
import fs from 'node:fs';
import { updateViteConfig } from '../updateViteConfig';

// Mock fs.promises.readFile and writeFile
vi.mock('node:fs', () => ({
  default: {
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
    },
  },
}));

// Mock needsCJS - we can mock this one as requested
vi.mock('../../../utils/parse/needsCJS.js', () => ({
  needsCJS: vi.fn(),
}));

// Mock spinner and logging
vi.mock('../../../console/logging.js', () => ({
  createSpinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  logError: vi.fn(),
}));

// Mock chalk to prevent any styling output
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text) => text),
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    blue: vi.fn((text) => text),
    cyan: vi.fn((text) => text),
    magenta: vi.fn((text) => text),
    white: vi.fn((text) => text),
    gray: vi.fn((text) => text),
    bold: vi.fn((text) => text),
  },
}));

// Mock @clack/prompts to prevent console output from spinners
vi.mock('@clack/prompts', () => ({
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    message: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
    message: vi.fn(),
  },
}));

// Import mocked functions
// @ts-expect-error - we want to mock this function
import { needsCJS } from '../../../utils/parse/needsCJS.js';

describe('updateViteConfig', () => {
  const mockReadFile = vi.mocked(fs.promises.readFile);
  const mockWriteFile = vi.mocked(fs.promises.writeFile);
  const mockNeedsCJS = vi.mocked(needsCJS);

  beforeEach(() => {
    vi.clearAllMocks();
    mockNeedsCJS.mockReturnValue(false); // Default to ESM
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper function to parse generated code and check for specific patterns
  function parseAndCheck(
    code: string,
    checks: {
      hasCompilerImport?: boolean;
      hasPluginInvocation?: boolean;
      alias?: string;
      namespace?: string;
    }
  ) {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const results = {
      hasCompilerImport: false,
      hasPluginInvocation: false,
      alias: null as string | null,
      namespace: null as string | null,
    };

    // Check for compiler import
    for (const node of ast.program.body) {
      if (
        node.type === 'ImportDeclaration' &&
        node.source.value === '@generaltranslation/compiler'
      ) {
        results.hasCompilerImport = true;
        for (const spec of node.specifiers) {
          if (
            spec.type === 'ImportSpecifier' &&
            spec.imported.type === 'Identifier' &&
            spec.imported.name === 'vite'
          ) {
            results.alias = spec.local.name;
          }
        }
      } else if (node.type === 'VariableDeclaration') {
        const decl = node.declarations[0];
        if (
          decl &&
          decl.init?.type === 'MemberExpression' &&
          decl.init.object?.type === 'CallExpression' &&
          decl.init.object.callee?.type === 'Identifier' &&
          decl.init.object.callee.name === 'require' &&
          decl.init.object.arguments?.[0]?.type === 'StringLiteral' &&
          decl.init.object.arguments[0].value ===
            '@generaltranslation/compiler' &&
          decl.init.property?.type === 'Identifier' &&
          decl.init.property.name === 'vite' &&
          decl.id?.type === 'Identifier'
        ) {
          results.hasCompilerImport = true;
          results.alias = decl.id.name;
        }
      }
    }

    // Check for plugin invocation (simplified)
    const codeString = code;
    if (
      checks.alias &&
      new RegExp(`${checks.alias}\\s*\\(\\s*\\)`).test(codeString)
    ) {
      results.hasPluginInvocation = true;
    }
    if (
      checks.namespace &&
      new RegExp(`${checks.namespace}\\.vite\\s*\\(\\s*\\)`).test(codeString)
    ) {
      results.hasPluginInvocation = true;
    }

    return results;
  }

  describe('ESM scenarios', () => {
    beforeEach(() => {
      mockNeedsCJS.mockReturnValue(false);
    });

    it('should add import and plugin to clean Vite config', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        
        export default defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
        packageJson: { type: 'module' },
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(results.hasPluginInvocation).toBe(true);
      expect(results.alias).toBe('gtCompiler');

      expect(filesUpdated).toContain('/path/to/vite.config.ts');
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it('should not add import if already present with alias', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import { vite as myCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [myCompiler()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      // Should preserve existing import and not add plugin (already present)
      expect(updatedCode).toContain('vite as myCompiler');
      expect(updatedCode).toContain('myCompiler()');
      expect(filesUpdated).toContain('/path/to/vite.config.ts');
    });

    it('should add plugin invocation when import exists but plugin missing', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import { vite as myCompiler } from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      // Should preserve existing import and add plugin
      expect(updatedCode).toContain('vite as myCompiler');
      expect(updatedCode).toContain('react()');
      expect(updatedCode).toContain('myCompiler()');
    });

    it('should handle namespace imports', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import * as gt from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      expect(updatedCode).toContain('* as gt');
      expect(updatedCode).toContain('gt.vite()');
    });

    it('should handle default imports', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import gtDefault from '@generaltranslation/compiler';
        
        export default defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      expect(updatedCode).toContain('import gtDefault');
      expect(updatedCode).toContain('gtDefault.vite()');
    });
  });

  describe('CJS scenarios', () => {
    beforeEach(() => {
      mockNeedsCJS.mockReturnValue(true);
    });

    it('should add require and plugin to CJS config', async () => {
      const inputCode = `
        const { defineConfig } = require('vite');
        const react = require('@vitejs/plugin-react');
        
        module.exports = defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.js',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      expect(updatedCode).toContain(
        'require("@generaltranslation/compiler").vite'
      );
      expect(updatedCode).toContain('gtCompiler()');
      expect(filesUpdated).toContain('/path/to/vite.config.js');
    });

    it('should handle existing CJS require with destructuring', async () => {
      const inputCode = `
        const { defineConfig } = require('vite');
        const { vite: myCompiler } = require('@generaltranslation/compiler');
        
        module.exports = defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.js',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      expect(updatedCode).toContain('vite: myCompiler');
      expect(updatedCode).toContain('myCompiler()');
    });

    it('should handle namespace require', async () => {
      const inputCode = `
        const { defineConfig } = require('vite');
        const gt = require('@generaltranslation/compiler');
        
        module.exports = defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.js',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      expect(updatedCode).toContain('const gt = require');
      expect(updatedCode).toContain('gt.vite()');
    });
  });

  describe('Warning scenarios', () => {
    it('should add warning when plugin invocation fails', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        
        // No plugins property - addPluginInvocation will fail
        export default defineConfig({
          server: { port: 3000 }
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      // Should have added import but failed to add plugin
      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Failed to add gt compiler plugin');
      expect(warnings[0]).toContain('Please add the plugin manually');
      expect(filesUpdated).toContain('/path/to/vite.config.ts');
    });

    it('should handle complex config with no plugins property', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        
        export default defineConfig({
          resolve: {
            alias: {
              '@': path.resolve(__dirname, 'src')
            }
          },
          build: {
            outDir: 'dist'
          }
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Failed to add gt compiler plugin');
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle conditional Vite config', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        
        export default defineConfig(({ command, mode }) => ({
          plugins: [
            react(),
            ...(mode === 'development' ? [devtools()] : [])
          ],
          build: {
            minify: command === 'build'
          }
        }));
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(results.hasPluginInvocation).toBe(false);

      expect(updatedCode).toContain('react()');
      expect(updatedCode).not.toContain('gtCompiler()');
      expect(filesUpdated).toContain('/path/to/vite.config.ts');
    });

    it('should handle TypeScript Vite config with type imports', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import type { UserConfig } from 'vite';
        
        const config: UserConfig = {
          plugins: [react()],
          server: { port: 3000 }
        };
        
        export default defineConfig(config);
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
        packageJson: { type: 'module' },
        tsconfigJson: { compilerOptions: { module: 'ESNext' } },
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(results.hasPluginInvocation).toBe(false);
      expect(filesUpdated).toContain('/path/to/vite.config.ts');
    });

    it('should preserve existing plugin configuration', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        
        export default defineConfig({
          plugins: [
            react({
              babel: {
                plugins: ['@babel/plugin-syntax-jsx']
              }
            })
          ],
          esbuild: {
            jsxFactory: 'React.createElement'
          }
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      // Should preserve existing configuration
      expect(updatedCode).toContain('@babel/plugin-syntax-jsx');
      expect(updatedCode).toContain('React.createElement');
      expect(updatedCode).toContain('gtCompiler()');

      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(results.hasPluginInvocation).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      // Should exit process on file read error
      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/nonexistent.ts',
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockWriteFile).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });

    it('should handle file write errors gracefully', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        export default defineConfig({ plugins: [] });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockRejectedValue(new Error('Permission denied'));

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(filesUpdated).toHaveLength(0);

      exitSpy.mockRestore();
    });

    it('should handle AST parsing errors gracefully', async () => {
      const invalidCode = `
        import { defineConfig } from 'vite';
        export default defineConfig({ 
          plugins: [
            // Invalid syntax
            }]
        });
      `;

      mockReadFile.mockResolvedValue(invalidCode);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      const exitSpy = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as any);

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mockWriteFile).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty file', async () => {
      const inputCode = '';

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      // Should add import but likely fail to add plugin (no plugins array)
      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(warnings).toHaveLength(1);
    });

    it('should handle file with only comments', async () => {
      const inputCode = `
        // This is a Vite configuration file
        /* 
         * TODO: Add plugins
         */
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(warnings).toHaveLength(1); // Should warn about failed plugin addition
    });

    it('should handle mixed ESM/CJS patterns', async () => {
      const inputCode = `
        import { defineConfig } from 'vite';
        const react = require('@vitejs/plugin-react');
        
        export default defineConfig({
          plugins: [react()]
        });
      `;

      mockReadFile.mockResolvedValue(inputCode);
      mockWriteFile.mockResolvedValue(undefined);

      const errors: string[] = [];
      const warnings: string[] = [];
      const filesUpdated: string[] = [];

      await updateViteConfig({
        errors,
        warnings,
        filesUpdated,
        viteConfigPath: '/path/to/vite.config.ts',
      });

      expect(mockWriteFile).toHaveBeenCalledOnce();
      const [, updatedCode] = mockWriteFile.mock.calls[0];

      // Should add ESM import (default behavior)
      const results = parseAndCheck(updatedCode as string, {
        alias: 'gtCompiler',
      });
      expect(results.hasCompilerImport).toBe(true);
      expect(results.hasPluginInvocation).toBe(true);
      expect(updatedCode).toContain('import { vite as gtCompiler }');
      expect(filesUpdated).toContain('/path/to/vite.config.ts');
    });
  });
});
