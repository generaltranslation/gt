#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// One build per swc_core ABI. Each is built into its own cargo target dir by
// the build:swc-plugin:* scripts. See SWC_PLUGIN_CURRENT_ABI_SUPPORT.
const builds = [
  { targetDir: 'target', fileName: 'gt_swc_plugin.wasm' },
  { targetDir: 'target-legacy', fileName: 'gt_swc_plugin_legacy.wasm' },
];
const destDir = './dist';

try {
  // 1. Create dist directory if it doesn't exist
  fs.mkdirSync(destDir, { recursive: true });

  for (const { targetDir, fileName } of builds) {
    const srcPath = `./swc-plugin/${targetDir}/wasm32-wasip1/release/gt_swc_plugin.wasm`;
    const destPath = path.join(destDir, fileName);

    // 2. Copy WASM file (equivalent to cp -p, preserving timestamps)
    fs.copyFileSync(srcPath, destPath);

    // Preserve timestamps like cp -p does
    const stats = fs.statSync(srcPath);
    fs.utimesSync(destPath, stats.atime, stats.mtime);
  }
} catch (error) {
  console.error('❌ Failed to copy WASM plugin:', error.message);
  process.exit(1);
}
