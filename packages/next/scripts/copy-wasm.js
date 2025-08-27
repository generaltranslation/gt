#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcPath = './swc-plugin/target/wasm32-wasip1/release/gt_swc_plugin.wasm';
const destDir = './dist';
const destPath = path.join(destDir, 'gt_swc_plugin.wasm');

try {
  // 1. Create dist directory if it doesn't exist
  fs.mkdirSync(destDir, { recursive: true });

  // 2. Copy WASM file (equivalent to cp -p, preserving timestamps)
  fs.copyFileSync(srcPath, destPath);

  // Preserve timestamps like cp -p does
  const stats = fs.statSync(srcPath);
  fs.utimesSync(destPath, stats.atime, stats.mtime);
} catch (error) {
  console.error('❌ Failed to copy WASM plugin:', error.message);
  process.exit(1);
}
