import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { updateBabelConfig } from '../updateBabelConfig.js';

describe('updateBabelConfig', () => {
  let tempDir: string;
  let babelConfigPath: string;

  beforeEach(() => {
    // Create a temporary directory for tests
    tempDir = path.join('/tmp', `babel-config-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    babelConfigPath = path.join(tempDir, 'babel.config.js');
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('creating new babel config', () => {
    it('should create a new babel.config.js if it does not exist and createIfMissing is true', () => {
      const relativeEntryPath = './app/index.tsx';

      const modified = updateBabelConfig(
        babelConfigPath,
        relativeEntryPath,
        true
      );

      expect(modified).toBe(true);
      expect(fs.existsSync(babelConfigPath)).toBe(true);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toContain('gt-react-native/plugin');
      expect(content).toContain('entryPointFilePath');
      expect(content).toContain(relativeEntryPath);
      expect(content).toContain('react-native-reanimated/plugin');
    });

    it('should return false if file does not exist and createIfMissing is false', () => {
      const relativeEntryPath = './app/index.tsx';

      const modified = updateBabelConfig(
        babelConfigPath,
        relativeEntryPath,
        false
      );

      expect(modified).toBe(false);
      expect(fs.existsSync(babelConfigPath)).toBe(false);
    });

    it('should include correct template structure for new config', () => {
      const relativeEntryPath = './app/index.tsx';

      updateBabelConfig(babelConfigPath, relativeEntryPath, true);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toContain('module.exports = function (api)');
      expect(content).toContain("presets: ['babel-preset-expo']");
      expect(content).toContain("const path = require('path')");
    });
  });

  describe('updating existing babel config', () => {
    it('should add gt-react-native plugin to existing config', () => {
      const existingConfig = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const relativeEntryPath = './app/index.tsx';
      const modified = updateBabelConfig(
        babelConfigPath,
        relativeEntryPath,
        false
      );

      expect(modified).toBe(true);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toContain('gt-react-native/plugin');
      expect(content).toContain('entryPointFilePath');
      expect(content).toContain(relativeEntryPath);
    });

    it('should add path require if missing', () => {
      const existingConfig = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const relativeEntryPath = './app/index.tsx';
      updateBabelConfig(babelConfigPath, relativeEntryPath, false);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      // Babel generates with double quotes, so check for either format
      expect(content).toMatch(/const path = require\(['"]path['"]\)/);
    });

    it('should not duplicate path require if already present', () => {
      const existingConfig = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const relativeEntryPath = './app/index.tsx';
      updateBabelConfig(babelConfigPath, relativeEntryPath, false);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      const pathRequireCount = (
        content.match(/const path = require\('path'\)/g) || []
      ).length;
      expect(pathRequireCount).toBe(1);
    });
  });

  describe('idempotence', () => {
    it('should not duplicate plugin when called twice', () => {
      const existingConfig = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const relativeEntryPath = './app/index.tsx';

      // First call
      updateBabelConfig(babelConfigPath, relativeEntryPath, false);
      const firstContent = fs.readFileSync(babelConfigPath, 'utf-8');

      // Second call
      updateBabelConfig(babelConfigPath, relativeEntryPath, false);
      const secondContent = fs.readFileSync(babelConfigPath, 'utf-8');

      const firstPluginCount = (
        firstContent.match(/gt-react-native\/plugin/g) || []
      ).length;
      const secondPluginCount = (
        secondContent.match(/gt-react-native\/plugin/g) || []
      ).length;

      expect(firstPluginCount).toBe(1);
      expect(secondPluginCount).toBe(1);
    });

    it('should update entryPointFilePath when called with different path', () => {
      const existingConfig = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        require('gt-react-native/plugin'),
        {
          entryPointFilePath: path.resolve(__dirname, './app/old-index.tsx'),
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const newRelativePath = './app/new-index.tsx';
      updateBabelConfig(babelConfigPath, newRelativePath, false);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toContain(newRelativePath);
      expect(content).not.toContain('./app/old-index.tsx');
    });
  });

  describe('different config styles', () => {
    it('should handle config with comments', () => {
      const existingConfig = `// Babel configuration
const path = require('path');

module.exports = function (api) {
  // Cache enabled
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated plugin
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const relativeEntryPath = './app/index.tsx';
      const modified = updateBabelConfig(
        babelConfigPath,
        relativeEntryPath,
        false
      );

      expect(modified).toBe(true);
      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toContain('gt-react-native/plugin');
    });

    it('should handle config with array form plugin', () => {
      const existingConfig = `const path = require('path');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-plugin', { option: true }],
      'react-native-reanimated/plugin',
    ],
  };
};
`;
      fs.writeFileSync(babelConfigPath, existingConfig);

      const relativeEntryPath = './app/index.tsx';
      const modified = updateBabelConfig(
        babelConfigPath,
        relativeEntryPath,
        false
      );

      expect(modified).toBe(true);
      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toContain('gt-react-native/plugin');
      // Should still have the other plugin
      expect(content).toContain('module-plugin');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid JavaScript syntax', () => {
      const invalidConfig = `module.exports = function (api) {
  return {
    plugins: [
      // Missing closing bracket
    ],
  };
`;
      fs.writeFileSync(babelConfigPath, invalidConfig);

      expect(() => {
        updateBabelConfig(babelConfigPath, './app/index.tsx', false);
      }).toThrow();
    });

    it('should add path require even if config has no plugins array', () => {
      const configWithoutPlugins = `module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
`;
      fs.writeFileSync(babelConfigPath, configWithoutPlugins);

      const modified = updateBabelConfig(
        babelConfigPath,
        './app/index.tsx',
        false
      );
      expect(modified).toBe(true);

      const content = fs.readFileSync(babelConfigPath, 'utf-8');
      expect(content).toMatch(/const path = require\(['"]path['"]\)/);
    });
  });
});
