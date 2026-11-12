#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const destDir = './dist';

// One build per SWC plugin runner generation; gt-next/config picks the file
// that matches the installed Next.js version (see SWC_PLUGIN_WASM_FILES).
const wasmBuilds = [
  {
    srcPath: './swc-plugin/target/wasm32-wasip1/release/gt_swc_plugin.wasm',
    fileName: 'gt_swc_plugin.wasm',
  },
  {
    srcPath:
      './swc-plugin/target/swc-v49/wasm32-wasip1/release/gt_swc_plugin.wasm',
    fileName: 'gt_swc_plugin_legacy.wasm',
  },
];

try {
  // 1. Create dist directory if it doesn't exist
  fs.mkdirSync(destDir, { recursive: true });

  for (const { srcPath, fileName } of wasmBuilds) {
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
