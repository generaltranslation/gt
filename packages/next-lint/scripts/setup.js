#!/usr/bin/env node

/**
 * Post-install setup script for @generaltranslation/gt-next-lint
 * Helps users set up the plugin automatically
 */

const fs = require('fs');
const path = require('path');

function setupESLintPlugin() {
  console.log('🔧 Setting up @generaltranslation/gt-next-lint...');
  
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  const eslintConfigPath = path.resolve(process.cwd(), 'eslint.config.mjs');
  
  let needsDevDep = false;
  let needsESLintConfig = false;
  
  // Check if @generaltranslation/gt-next-lint is in devDependencies
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const devDeps = packageJson.devDependencies || {};
    
    if (!devDeps['@generaltranslation/gt-next-lint']) {
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
      console.log('   npm install --save-dev @generaltranslation/gt-next-lint');
      console.log('   # or');
      console.log('   yarn add --dev @generaltranslation/gt-next-lint');
    }
    
    if (needsESLintConfig) {
      console.log('2. The ESLint plugin will be automatically configured when you use withGTConfig()');
      console.log('   Or manually create eslint.config.mjs:');
      console.log(`
import gtNext from '@generaltranslation/gt-next-lint';

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
    console.log('✅ @generaltranslation/gt-next-lint is already set up!');
  }
}

// Only run if this is being executed directly (not required)
if (require.main === module) {
  setupESLintPlugin();
}

module.exports = { setupESLintPlugin };