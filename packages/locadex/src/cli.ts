#!/usr/bin/env node
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { setupCommand } from './commands/setup.js';
import { i18nCommand } from './commands/i18n.js';
import { startCommand } from './commands/run.js';

const packageJson = JSON.parse(
  readFileSync(fromPackageRoot('package.json'), 'utf8')
);

const program = new Command();

program
  .name('locadex')
  .description('AI agent for internationalization')
  .version(packageJson.version)
  .action(startCommand);

program
  .command('run')
  .description('Fully internationalize your project')
  .action(startCommand);

program
  .command('setup')
  .description('Set up locadex for your project')
  .action(setupCommand);

program
  .command('i18n')
  .description('Run AI-powered internationalization tasks')
  .action(i18nCommand);

program.parse();
