import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectFramework } from '../detectFramework.js';

describe('detectFramework', () => {
  let appDirectory: string;

  beforeEach(() => {
    appDirectory = fs.mkdtempSync(path.join(tmpdir(), 'gt-detect-'));
    vi.spyOn(process, 'cwd').mockReturnValue(appDirectory);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(appDirectory, { recursive: true, force: true });
  });

  function writePackageJson(packageJson: Record<string, unknown>) {
    fs.writeFileSync(
      path.join(appDirectory, 'package.json'),
      JSON.stringify(packageJson)
    );
  }

  it('detects TanStack Start before its Vite dependency', async () => {
    writePackageJson({
      dependencies: { '@tanstack/react-start': '^1.0.0', react: '^19.0.0' },
      devDependencies: { vite: '^7.0.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'tanstack-start',
      type: 'react',
    });
  });

  it('still detects a plain Vite app', async () => {
    writePackageJson({
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^7.0.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });

  it('detects a Hydrogen app as React Router before its Vite dependency', async () => {
    writePackageJson({
      dependencies: {
        '@shopify/hydrogen': '^2026.4.0',
        'react-router': '^7.0.0',
        react: '^18.0.0',
      },
      devDependencies: { '@react-router/dev': '^7.0.0', vite: '^7.0.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'react-router',
      type: 'react',
    });
  });

  it('keeps a Vite SPA using only the react-router library as Vite', async () => {
    writePackageJson({
      dependencies: { 'react-router': '^7.0.0', react: '^19.0.0' },
      devDependencies: { vite: '^7.0.0' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'vite',
      type: 'react',
    });
  });

  it('detects an Expo app as React Native instead of plain React', async () => {
    writePackageJson({
      dependencies: {
        expo: '~58.0.22',
        'expo-router': '~58.0.29',
        react: '19.3.0',
        'react-native': '0.88.1',
        'react-native-web': '~0.21.4',
      },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'react-native',
      type: 'react-native',
    });
  });

  it('detects a bare React Native app as React Native', async () => {
    writePackageJson({
      dependencies: { react: '19.3.0', 'react-native': '0.88.1' },
      devDependencies: { '@react-native/metro-config': '0.88.1' },
    });

    await expect(detectFramework()).resolves.toEqual({
      name: 'react-native',
      type: 'react-native',
    });
  });
});
