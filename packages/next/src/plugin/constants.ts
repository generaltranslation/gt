export const BABEL_PLUGIN_SUPPORT = '17.0.0';

export const SWC_PLUGIN_SUPPORT = '16.1.0';

// SWC wasm plugins only load in a host built against a compatible swc_core.
// Next.js changed its swc_plugin_runner ABI in 16.4.0, so gt-next ships two
// builds of the plugin from the same source and picks one by Next.js version.
export const SWC_PLUGIN_CURRENT_ABI_SUPPORT = '16.4.0';
export const SWC_PLUGIN_CURRENT_WASM = 'gt_swc_plugin.wasm';
export const SWC_PLUGIN_LEGACY_WASM = 'gt_swc_plugin_legacy.wasm';

// Minimum Next versions for feature-specific plugin behavior.
export const ROOT_PARAM_STABILITY = {
  unsupported: '0.0.0',
  unstable: '15.2.0',
  experimental: '15.5.0',
  stable: '16.3.0',
};

export const STABLE_TURBO_CONFIG_VERSION = '15.3.0';

export const LOCALE_REFRESH_SUPPORT = '16.1.0';
