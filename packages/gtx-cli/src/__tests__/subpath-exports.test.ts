import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('gtx-cli subpath exports', () => {
  it('re-exports config/generateSettings', async () => {
    const mod = await import('../config/generateSettings');
    expect(mod.DEFAULT_SRC_PATTERNS).toBeDefined();
  });

  it('re-exports config/resolveConfig', async () => {
    const mod = await import('../config/resolveConfig');
    expect(typeof mod.resolveConfig).toBe('function');
  });

  it('re-exports fs/matchFiles', async () => {
    const mod = await import('../fs/matchFiles');
    expect(typeof mod.matchFiles).toBe('function');
  });

  it('re-exports fs/config/setupConfig', async () => {
    const mod = await import('../fs/config/setupConfig');
    expect(typeof mod.createOrUpdateConfig).toBe('function');
  });

  it('re-exports next/parse/handleInitGT', async () => {
    const mod = await import('../next/parse/handleInitGT');
    expect(typeof mod.handleInitGT).toBe('function');
  });

  it('re-exports next/parse/wrapContent', async () => {
    const mod = await import('../next/parse/wrapContent');
    expect(typeof mod.wrapContentNext).toBe('function');
  });

  it('re-exports react/parse/wrapContent', async () => {
    const mod = await import('../react/parse/wrapContent');
    expect(typeof mod.wrapContentReact).toBe('function');
  });

  it('re-exports utils/packageManager', async () => {
    const mod = await import('../utils/packageManager');
    expect(mod.NoPackageManagerError).toBeDefined();
  });

  it('re-exports utils/packageJson', async () => {
    const mod = await import('../utils/packageJson');
    expect(typeof mod.searchForPackageJson).toBe('function');
    expect(typeof mod.getPackageJson).toBe('function');
  });

  it('re-exports utils/packageInfo', async () => {
    const mod = await import('../utils/packageInfo');
    expect(typeof mod.getPackageInfo).toBe('function');
  });

  it('re-exports utils/installPackage', async () => {
    const mod = await import('../utils/installPackage');
    expect(typeof mod.installPackage).toBe('function');
  });

  it('exposes the root once (no ./index alias)', () => {
    const { exports } = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
    );
    expect(exports).not.toHaveProperty('./index');
  });
});
