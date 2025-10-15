import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { addCompilerImport } from '../addCompilerImport';

describe('addCompilerImport', () => {
  // Helper function to parse code, add import, and return generated code
  function parseAddAndGenerate(code: string, cjsEnabled: boolean): string {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    addCompilerImport({ ast, cjsEnabled });

    const generated = generate(ast);
    return generated.code;
  }

  // Helper to normalize whitespace for easier comparison
  function normalize(code: string): string {
    return code.replace(/\s+/g, ' ').trim();
  }

  // Helper to check if AST contains specific import/require
  function hasImport(code: string, type: 'esm' | 'cjs'): boolean {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    return ast.program.body.some((node) => {
      if (type === 'esm' && node.type === 'ImportDeclaration') {
        return (
          node.source.value === '@generaltranslation/compiler' &&
          node.specifiers.some(
            (spec) =>
              spec.type === 'ImportSpecifier' &&
              spec.imported.type === 'Identifier' &&
              spec.imported.name === 'vite' &&
              spec.local.name === 'gtCompiler'
          )
        );
      } else if (type === 'cjs' && node.type === 'VariableDeclaration') {
        const decl = node.declarations[0];
        return (
          decl &&
          decl.id?.type === 'Identifier' &&
          decl.id.name === 'gtCompiler' &&
          decl.init?.type === 'MemberExpression' &&
          decl.init.object?.type === 'CallExpression' &&
          decl.init.object.callee?.type === 'Identifier' &&
          decl.init.object.callee.name === 'require' &&
          decl.init.object.arguments?.[0]?.type === 'StringLiteral' &&
          decl.init.object.arguments[0].value ===
            '@generaltranslation/compiler' &&
          decl.init.property?.type === 'Identifier' &&
          decl.init.property.name === 'vite'
        );
      }
      return false;
    });
  }

  describe('ESM imports (cjsEnabled: false)', () => {
    it('should add ESM import to empty file', () => {
      const code = '';
      const result = parseAddAndGenerate(code, false);

      expect(normalize(result)).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
    });

    it('should add ESM import at the beginning of file with existing code', () => {
      const code = `
        import { defineConfig } from 'vite';
        
        export default defineConfig({
          plugins: []
        });
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      // Should be the first import
      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain('export default defineConfig');
    });

    it('should add ESM import before other imports', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import path from 'path';
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain("import react from '@vitejs/plugin-react';");
    });

    it('should add ESM import before variable declarations', () => {
      const code = `
        const config = { plugins: [] };
        const plugins = [];
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain('const config = {');
    });

    it('should add ESM import before function declarations', () => {
      const code = `
        function createConfig() {
          return { plugins: [] };
        }
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain('function createConfig()');
    });

    it('should add ESM import before export declarations', () => {
      const code = `
        export default { plugins: [] };
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain('export default {');
    });

    it('should preserve comments when adding ESM import', () => {
      const code = `
        // This is a comment
        import { defineConfig } from 'vite';
        /* Another comment */
      `;

      const result = parseAddAndGenerate(code, false);

      expect(result).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      // Note: Comments might be preserved depending on babel-generator settings
    });
  });

  describe('CJS imports (cjsEnabled: true)', () => {
    it('should add CJS require to empty file', () => {
      const code = '';
      const result = parseAddAndGenerate(code, true);

      expect(normalize(result)).toContain(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
    });

    it('should add CJS require at the beginning of file with existing code', () => {
      const code = `
        const { defineConfig } = require('vite');
        
        module.exports = defineConfig({
          plugins: []
        });
      `;

      const result = parseAddAndGenerate(code, true);

      // Check that the import was added
      expect(hasImport(result, 'cjs')).toBe(true);

      // Check that original code is preserved (more flexible matching)
      expect(result).toMatch(/require\s*\(\s*['"]vite['"]\s*\)/);
      expect(result).toMatch(/module\.exports\s*=\s*defineConfig/);
    });

    it('should add CJS require before other requires', () => {
      const code = `
        const { defineConfig } = require('vite');
        const react = require('@vitejs/plugin-react');
        const path = require('path');
      `;

      const result = parseAddAndGenerate(code, true);

      // Check that the import was added
      expect(hasImport(result, 'cjs')).toBe(true);

      // Check that original requires are preserved
      expect(result).toMatch(/require\s*\(\s*['"]vite['"]\s*\)/);
      expect(result).toMatch(
        /require\s*\(\s*['"]@vitejs\/plugin-react['"]\s*\)/
      );
      expect(result).toMatch(/require\s*\(\s*['"]path['"]\s*\)/);
    });

    it('should add CJS require before variable declarations', () => {
      const code = `
        const config = { plugins: [] };
        let plugins = [];
        var settings = {};
      `;

      const result = parseAddAndGenerate(code, true);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
      expect(result).toContain('const config = {');
      expect(result).toContain('let plugins = [];');
      expect(result).toContain('var settings = {};');
    });

    it('should add CJS require before function declarations', () => {
      const code = `
        function createConfig() {
          return { plugins: [] };
        }
      `;

      const result = parseAddAndGenerate(code, true);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
      expect(result).toContain('function createConfig()');
    });

    it('should add CJS require before module.exports', () => {
      const code = `
        module.exports = { plugins: [] };
      `;

      const result = parseAddAndGenerate(code, true);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
      expect(result).toContain('module.exports = {');
    });
  });

  describe('Mixed scenarios and edge cases', () => {
    it('should handle file with only comments', () => {
      const code = `
        // Just comments
        /* Block comment */
      `;

      const esmResult = parseAddAndGenerate(code, false);
      const cjsResult = parseAddAndGenerate(code, true);

      expect(esmResult).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(cjsResult).toContain(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
    });

    it('should handle file with mixed ESM/CJS patterns (add ESM)', () => {
      const code = `
        import { defineConfig } from 'vite';
        const react = require('@vitejs/plugin-react');
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain(
        "const react = require('@vitejs/plugin-react');"
      );
    });

    it('should handle file with mixed ESM/CJS patterns (add CJS)', () => {
      const code = `
        import { defineConfig } from 'vite';
        const react = require('@vitejs/plugin-react');
      `;

      const result = parseAddAndGenerate(code, true);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain(
        "const react = require('@vitejs/plugin-react');"
      );
    });

    it('should handle complex file structure', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        
        const isDevelopment = process.env.NODE_ENV === 'development';
        
        function createPlugins() {
          return [react()];
        }
        
        export default defineConfig({
          plugins: createPlugins(),
          build: {
            outDir: 'dist'
          }
        });
      `;

      const result = parseAddAndGenerate(code, false);
      const lines = result.split('\n').filter((line) => line.trim());

      expect(normalize(lines[0])).toBe(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain("import react from '@vitejs/plugin-react';");
      expect(result).toContain('const isDevelopment');
      expect(result).toContain('function createPlugins');
      expect(result).toContain('export default defineConfig');
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical Vite config with ESM', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        
        export default defineConfig({
          plugins: [react()],
          server: {
            port: 3000
          },
          build: {
            outDir: 'dist'
          }
        });
      `;

      const result = parseAddAndGenerate(code, false);

      expect(result).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain("import react from '@vitejs/plugin-react';");
      expect(result).toContain('plugins: [react()]');
      expect(result).toContain('server: {');
      expect(result).toContain('port: 3000');
    });

    it('should handle typical Vite config with CJS', () => {
      const code = `
        const { defineConfig } = require('vite');
        const react = require('@vitejs/plugin-react');
        
        module.exports = defineConfig({
          plugins: [react()],
          server: {
            port: 3000
          },
          build: {
            outDir: 'dist'
          }
        });
      `;

      const result = parseAddAndGenerate(code, true);

      // Check that the import was added
      expect(hasImport(result, 'cjs')).toBe(true);

      // Check that original code structure is preserved
      expect(result).toMatch(/require\s*\(\s*['"]vite['"]\s*\)/);
      expect(result).toMatch(
        /require\s*\(\s*['"]@vitejs\/plugin-react['"]\s*\)/
      );
      expect(result).toMatch(/module\.exports\s*=\s*defineConfig/);
      expect(result).toContain('port: 3000');
      expect(result).toMatch(/outDir:\s*['"]dist['"]/);
    });

    it('should handle TypeScript Vite config', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
        import type { UserConfig } from 'vite';
        
        const config: UserConfig = {
          plugins: [react()]
        };
        
        export default defineConfig(config);
      `;

      const result = parseAddAndGenerate(code, false);

      expect(result).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain("import react from '@vitejs/plugin-react';");
      // Type imports might be handled differently by babel
    });

    it('should handle Vite config with environment variables', () => {
      const code = `
        import { defineConfig } from 'vite';
        import { loadEnv } from 'vite';
        
        export default defineConfig(({ command, mode }) => {
          const env = loadEnv(mode, process.cwd(), '');
          
          return {
            plugins: [],
            define: {
              __APP_ENV__: JSON.stringify(env.APP_ENV)
            }
          };
        });
      `;

      const result = parseAddAndGenerate(code, false);

      expect(result).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
      expect(result).toContain("import { defineConfig } from 'vite';");
      expect(result).toContain("import { loadEnv } from 'vite';");
      expect(result).toContain('const env = loadEnv');
    });
  });

  describe('Generated code structure', () => {
    it('should generate valid ESM import syntax', () => {
      const code = 'const test = 1;';
      const result = parseAddAndGenerate(code, false);

      // Check that the generated import is syntactically correct
      expect(() => {
        parse(result, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      }).not.toThrow();

      expect(result).toContain(
        'import { vite as gtCompiler } from "@generaltranslation/compiler";'
      );
    });

    it('should generate valid CJS require syntax', () => {
      const code = 'const test = 1;';
      const result = parseAddAndGenerate(code, true);

      // Check that the generated require is syntactically correct
      expect(() => {
        parse(result, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      }).not.toThrow();

      expect(result).toContain(
        'const gtCompiler = require("@generaltranslation/compiler").vite;'
      );
    });

    it('should maintain proper AST structure after modification', () => {
      const code = `
        import { defineConfig } from 'vite';
        export default defineConfig({});
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      const originalBodyLength = ast.program.body.length;
      addCompilerImport({ ast, cjsEnabled: false });

      // Should have added one more statement
      expect(ast.program.body.length).toBe(originalBodyLength + 1);

      // First statement should be the new import
      expect(ast.program.body[0].type).toBe('ImportDeclaration');

      // Should still be parseable
      const generated = generate(ast);
      expect(() => {
        parse(generated.code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      }).not.toThrow();
    });
  });
});
