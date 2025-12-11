import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
// import terser from '@rollup/plugin-terser'; // Disabled for now due to ES2022 syntax issues
import resolve from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';

// Node.js built-ins to keep external
const nodeBuiltins = [
  'fs', 'path', 'os', 'crypto', 'util', 'stream', 'events', 'buffer', 'url',
  'querystring', 'http', 'https', 'net', 'tls', 'zlib', 'child_process',
  'cluster', 'worker_threads', 'perf_hooks', 'inspector', 'readline',
  'repl', 'string_decoder', 'timers', 'tty', 'v8', 'vm', 'wasi', 'async_hooks',
  'dns', 'dgram', 'module', 'process'
];

// Get all dependencies except the ones we want to bundle
import { readFileSync } from 'fs';
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const allDependencies = Object.keys(packageJson.dependencies || {});

// Only bundle @clack/prompts, keep everything else external
const dependenciesToBundle = ['@clack/prompts'];
const externalDependencies = allDependencies.filter(dep => 
  !dependenciesToBundle.includes(dep)
);

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/main.js',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true, // Inline dynamic imports to create single file
  },
  plugins: [
    json(), // Handle JSON imports
    resolve({
      extensions: ['.js', '.mjs', '.ts'],
      preferBuiltins: true, // Prefer Node.js built-ins over polyfills
    }),
    typescript({ 
      tsconfig: './tsconfig.json',
      sourceMap: true,
      inlineSources: true,
      outputToFilesystem: false, // Prevent duplicate shebang
    }),
    commonjs(), // Handle CommonJS dependencies
    // terser({ // Optional minification - disabled for debugging
    //   format: {
    //     comments: false,
    //     preserve_annotations: true,
    //   },
    //   mangle: false, // Keep function names for better stack traces
    // }),
  ],
  external: [...nodeBuiltins, ...externalDependencies], // Keep Node.js built-ins and most dependencies external
};