#!/usr/bin/env node

import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

import './utils/shutdown.js';
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fromPackageRoot } from './utils/getPaths.js';
import { main } from 'gtx-cli/index';
import { GT_DASHBOARD_URL } from 'gtx-cli/utils/constants';

const packageJson = JSON.parse(
  readFileSync(fromPackageRoot('package.json'), 'utf8')
);

const program = new Command();

program
  .name('locadex')
  .description('AI agent for internationalization')
  .version(packageJson.version);

program
  .command('start')
  .description('Get started with Locadex')
  .action(async () => {
    const urlToOpen = `${GT_DASHBOARD_URL}/locadex`;
    await import('open').then((open) =>
      open.default(urlToOpen, {
        wait: false,
      })
    );
  });

main(program);

program.parse();
