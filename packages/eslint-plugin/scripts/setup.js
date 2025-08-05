#!/usr/bin/env node

/**
 * Post-install setup script for eslint-plugin-gt-next
 * Helps users set up the plugin automatically
 */

const fs = require('fs');
const path = require('path');

function setupESLintPlugin() {
  console.log('🔧 Setting up eslint-plugin-gt-next...');
  
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const eslintConfigPath = path.resolve(process.cwd(), 'eslint.config.mjs');
  
  let needsDevDep = false;
  let needsESLintConfig = false;
  
  // Check if eslint-plugin-gt-next is in devDependencies
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const devDeps = packageJson.devDependencies || {};
    
    if (!devDeps['eslint-plugin-gt-next']) {
      needsDevDep = true;
    }
  }
  
  // Check if ESLint config exists
  if (!fs.existsSync(eslintConfigPath)) {
    needsESLintConfig = true;
  }
  
  if (needsDevDep || needsESLintConfig) {
    console.log('\n📋 To complete the setup:');
    
    if (needsDevDep) {
      console.log('1. Add the plugin to your devDependencies:');
      console.log('   npm install --save-dev eslint-plugin-gt-next');
      console.log('   # or');
      console.log('   yarn add --dev eslint-plugin-gt-next');
    }
    
    if (needsESLintConfig) {
      console.log('2. The ESLint plugin will be automatically configured when you use withGTConfig()');
      console.log('   Or manually create eslint.config.mjs:');
      console.log(`
import gtNext from 'eslint-plugin-gt-next';

export default [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      'gt-next': gtNext,
    },
    rules: {
      'gt-next/no-unwrapped-dynamic-content': 'warn',
    },
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];`);
    }
    
    console.log('\n✅ Setup complete! The plugin will automatically detect unwrapped dynamic content in <T> components.');
  } else {
    console.log('✅ eslint-plugin-gt-next is already set up!');
  }
}

// Only run if this is being executed directly (not required)
if (require.main === module) {
  setupESLintPlugin();
}

module.exports = { setupESLintPlugin };