export const BABEL_PLUGIN_SUPPORT = '17.0.0';

export const SWC_PLUGIN_SUPPORT = '16.1.0';

// Next.js only loads SWC plugins built against an swc_core its plugin runner
// accepts, so dist ships one wasm per runner generation.
export const SWC_PLUGIN_WASM_FILES = {
  // Next.js >= 16.4 (plugin runner 34, swc_core 79). Runner 34 landed in
  // 16.4.0-canary.15; earlier 16.4 canaries still need the legacy build.
  current: {
    minNextVersion: '16.4.0',
    minCanary: 15,
    fileName: 'gt_swc_plugin.wasm',
  },
  // Next.js 16.1 - 16.3 (swc_core 49)
  legacy: { fileName: 'gt_swc_plugin_legacy.wasm' },
} as const;

// Minimum Next versions for feature-specific plugin behavior.
export const ROOT_PARAM_STABILITY = {
  unsupported: '0.0.0',
  unstable: '15.2.0',
  experimental: '15.5.0',
  stable: '16.3.0',
};

export const STABLE_TURBO_CONFIG_VERSION = '15.3.0';

export const LOCALE_REFRESH_SUPPORT = '16.1.0';
