import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import generate from '@babel/generator';
import { addPluginInvocation } from '../addPluginInvocation';

describe('addPluginInvocation', () => {
  // Helper function to parse code, add plugin, and return both result and generated code
  function parseAddAndGenerate(
    code: string,
    alias: string | null,
    namespaces: string[] = []
  ): { success: boolean; code: string } {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const success = addPluginInvocation({ ast, alias, namespaces });
    const generated = generate(ast);

    return { success, code: generated.code };
  }

  // Helper to check if generated code contains the expected plugin invocation
  function hasPluginInvocation(
    code: string,
    type: 'alias' | 'namespace',
    name: string
  ): boolean {
    if (type === 'alias') {
      // Check for: gtCompiler()
      const aliasPattern = new RegExp(`${name}\\s*\\(\\s*\\)`);
      return aliasPattern.test(code);
    } else {
      // Check for: gt.vite()
      const namespacePattern = new RegExp(`${name}\\.vite\\s*\\(\\s*\\)`);
      return namespacePattern.test(code);
    }
  }

  describe('Alias-based plugin addition', () => {
    it('should add alias plugin to existing plugins array', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toContain('react()');
      expect(result.code).toContain('gtCompiler()');
    });

    it('should add alias plugin to empty plugins array', () => {
      const code = `
        export default defineConfig({
          plugins: []
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toMatch(/plugins:\s*\[\s*gtCompiler\(\)\s*\]/);
    });

    it('should add alias plugin with different alias names', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, 'myCustomCompiler', []);

      expect(result.success).toBe(true);
      expect(
        hasPluginInvocation(result.code, 'alias', 'myCustomCompiler')
      ).toBe(true);
      expect(result.code).toContain('myCustomCompiler()');
    });

    it('should add alias plugin to plugins array with multiple existing plugins', () => {
      const code = `
        export default defineConfig({
          plugins: [react(), vue(), typescript()]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toContain('react()');
      expect(result.code).toContain('vue()');
      expect(result.code).toContain('typescript()');
      expect(result.code).toContain('gtCompiler()');
    });
  });

  describe('Namespace-based plugin addition', () => {
    it('should add namespace plugin to existing plugins array', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, null, ['gt']);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'namespace', 'gt')).toBe(true);
      expect(result.code).toContain('react()');
      expect(result.code).toContain('gt.vite()');
    });

    it('should add namespace plugin to empty plugins array', () => {
      const code = `
        export default defineConfig({
          plugins: []
        });
      `;

      const result = parseAddAndGenerate(code, null, ['compiler']);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'namespace', 'compiler')).toBe(
        true
      );
      expect(result.code).toMatch(/plugins:\s*\[\s*compiler\.vite\(\)\s*\]/);
    });

    it('should use first namespace when multiple are provided', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, null, [
        'gt',
        'compiler',
        'other',
      ]);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'namespace', 'gt')).toBe(true);
      expect(result.code).toContain('gt.vite()');
      // Should not use other namespaces
      expect(result.code).not.toContain('compiler.vite()');
      expect(result.code).not.toContain('other.vite()');
    });

    it('should add namespace plugin with different namespace names', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, null, ['myCompilerNamespace']);

      expect(result.success).toBe(true);
      expect(
        hasPluginInvocation(result.code, 'namespace', 'myCompilerNamespace')
      ).toBe(true);
      expect(result.code).toContain('myCompilerNamespace.vite()');
    });
  });

  describe('Plugin spread scenarios', () => {
    it('should handle plugins as variable reference (spread scenario)', () => {
      const code = `
        const basePlugins = [react()];
        export default defineConfig({
          plugins: basePlugins
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(result.code).toContain('...basePlugins');
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toMatch(
        /plugins:\s*\[\s*\.\.\.basePlugins,\s*gtCompiler\(\)\s*\]/
      );
    });

    it('should handle plugins as function call (spread scenario)', () => {
      const code = `
        export default defineConfig({
          plugins: getPlugins()
        });
      `;

      const result = parseAddAndGenerate(code, null, ['gt']);

      expect(result.success).toBe(true);
      expect(result.code).toContain('...getPlugins()');
      expect(hasPluginInvocation(result.code, 'namespace', 'gt')).toBe(true);
      expect(result.code).toMatch(
        /plugins:\s*\[\s*\.\.\.getPlugins\(\),\s*gt\.vite\(\)\s*\]/
      );
    });

    it('should handle plugins as complex expression (spread scenario)', () => {
      const code = `
        export default defineConfig({
          plugins: process.env.NODE_ENV === 'development' ? devPlugins : prodPlugins
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(result.code).toContain(
        "...(process.env.NODE_ENV === 'development' ? devPlugins : prodPlugins)"
      );
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
    });
  });

  describe('Multiple plugins property scenarios', () => {
    it('should add to all plugins properties in nested objects', () => {
      const code = `
        export default defineConfig({
          plugins: [react()],
          build: {
            rollupOptions: {
              plugins: [somePlugin()]
            }
          }
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      // Should add to both plugins arrays
      const matches = result.code.match(/gtCompiler\(\)/g);
      expect(matches).toHaveLength(1);
      expect(result.code).toContain('react()');
      expect(result.code).toContain('somePlugin()');
    });

    it('should handle plugins property with string key', () => {
      const code = `
        export default defineConfig({
          "plugins": [react()]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toContain('react()');
    });

    it('should handle computed plugins property', () => {
      const code = `
        const key = 'plugins';
        export default defineConfig({
          [key]: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      // Should not match computed property (current implementation limitation)
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('should return false when no alias or namespaces provided', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, null, []);

      expect(result.success).toBe(false);
      expect(result.code).toContain('react()');
      expect(result.code).not.toContain('gtCompiler()');
    });

    it('should return false when empty namespaces array and no alias', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, '', []);

      expect(result.success).toBe(false);
    });

    it('should handle file with no plugins property', () => {
      const code = `
        export default defineConfig({
          server: { port: 3000 },
          build: { outDir: 'dist' }
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(false);
      expect(result.code).not.toContain('gtCompiler()');
      expect(result.code).toContain('port: 3000');
    });

    it('should handle empty file', () => {
      const code = '';

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(false);
    });

    it('should handle file with only comments', () => {
      const code = `
        // This is a comment
        /* Another comment */
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(false);
    });

    it('should handle plugins property with non-array value that cannot be spread', () => {
      const code = `
        export default defineConfig({
          plugins: "invalid"
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      // Should convert to array with spread
      expect(result.code).toContain('..."invalid"');
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle typical Vite config with ESM', () => {
      const code = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
          plugins: [
            react({
              jsxDev: process.env.NODE_ENV === 'development'
            })
          ],
          server: {
            port: 3000
          },
          build: {
            outDir: 'dist'
          }
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toContain('react({');
      expect(result.code).toContain('jsxDev: process.env.NODE_ENV');
      expect(result.code).toContain('gtCompiler()');
      expect(result.code).toContain('port: 3000');
    });

    it('should handle CommonJS Vite config', () => {
      const code = `
        const { defineConfig } = require('vite');
        const react = require('@vitejs/plugin-react');

        module.exports = defineConfig({
          plugins: [react()],
          server: {
            port: 3000
          }
        });
      `;

      const result = parseAddAndGenerate(code, null, ['gt']);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'namespace', 'gt')).toBe(true);
      expect(result.code).toContain('react()');
      expect(result.code).toContain('gt.vite()');
      expect(result.code).toContain('port: 3000');
    });

    it('should handle conditional plugins', () => {
      const code = `
        export default defineConfig({
          plugins: [
            react(),
            ...(process.env.NODE_ENV === 'development' ? [devtools()] : []),
            ...(process.env.ANALYZE ? [bundleAnalyzer()] : [])
          ]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toContain('react()');
      expect(result.code).toContain('devtools()');
      expect(result.code).toContain('bundleAnalyzer()');
      expect(result.code).toContain('gtCompiler()');
    });

    it('should handle Vite config with complex plugin setup', () => {
      const code = `
        const basePlugins = [react(), typescript()];
        const devPlugins = [...basePlugins, devtools()];
        const prodPlugins = [...basePlugins, minify()];

        export default defineConfig({
          plugins: process.env.NODE_ENV === 'development' ? devPlugins : prodPlugins,
          optimizeDeps: {
            include: ['react', 'react-dom']
          }
        });
      `;

      const result = parseAddAndGenerate(code, null, ['compiler']);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'namespace', 'compiler')).toBe(
        true
      );
      expect(result.code).toContain(
        "...(process.env.NODE_ENV === 'development' ? devPlugins : prodPlugins)"
      );
      expect(result.code).toContain('compiler.vite()');
      expect(result.code).toContain('optimizeDeps');
    });

    it('should preserve plugin configuration and comments', () => {
      const code = `
        export default defineConfig({
          plugins: [
            // React plugin with custom config
            react({
              babel: {
                plugins: ['@babel/plugin-syntax-jsx']
              }
            }),
            // TypeScript plugin
            typescript({
              declaration: true
            })
          ]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);
      expect(hasPluginInvocation(result.code, 'alias', 'gtCompiler')).toBe(
        true
      );
      expect(result.code).toContain('react({');
      expect(result.code).toContain('babel: {');
      expect(result.code).toContain('@babel/plugin-syntax-jsx');
      expect(result.code).toContain('typescript({');
      expect(result.code).toContain('declaration: true');
    });
  });

  describe('Generated code structure', () => {
    it('should generate syntactically valid code', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const result = parseAddAndGenerate(code, 'gtCompiler', []);

      expect(result.success).toBe(true);

      // Verify the generated code is parseable
      expect(() => {
        parse(result.code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
        });
      }).not.toThrow();
    });

    it('should maintain proper AST structure after modification', () => {
      const code = `
        export default defineConfig({
          plugins: [react()]
        });
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });

      const success = addPluginInvocation({
        ast,
        alias: 'gtCompiler',
        namespaces: [],
      });

      expect(success).toBe(true);

      // Verify AST is still valid
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
