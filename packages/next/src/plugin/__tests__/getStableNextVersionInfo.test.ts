import { describe, expect, it } from 'vitest';
import {
  getRootParamStability,
  getSwcPluginWasmFileName,
} from '../getStableNextVersionInfo';

describe('getRootParamStability', () => {
  it.each([
    ['14.2.0', 'unsupported'],
    ['15.2.0', 'unstable'],
    ['15.4.9', 'unstable'],
    ['15.5.0', 'experimental'],
    ['16.2.9', 'experimental'],
    ['16.3.0', 'stable'],
    ['17.0.0', 'stable'],
  ] as const)('classifies Next.js %s as %s', (nextVersion, expected) => {
    expect(getRootParamStability(nextVersion)).toBe(expected);
  });
});

describe('getSwcPluginWasmFileName', () => {
  it.each([
    ['16.1.0', 'gt_swc_plugin_legacy.wasm'],
    ['16.2.9', 'gt_swc_plugin_legacy.wasm'],
    ['16.3.8', 'gt_swc_plugin_legacy.wasm'],
    ['16.4.0', 'gt_swc_plugin.wasm'],
    ['16.4.5', 'gt_swc_plugin.wasm'],
    ['16.5.0-canary.40', 'gt_swc_plugin.wasm'],
    ['17.0.0', 'gt_swc_plugin.wasm'],
  ] as const)('uses %s -> %s', (nextVersion, expected) => {
    expect(getSwcPluginWasmFileName(nextVersion)).toBe(expected);
  });
});
