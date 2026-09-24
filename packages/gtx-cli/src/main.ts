#!/usr/bin/env node

import { main } from 'gt';
import { loadEnv } from 'gt/utils/loadEnv';
import { program } from 'commander';

loadEnv();

main(program);
program.name('gtx-cli');
program.parse();
