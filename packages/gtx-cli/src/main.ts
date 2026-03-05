#!/usr/bin/env node

import { main } from 'gt';
import dotenv from 'dotenv';
import { program } from 'commander';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

main(program);
program.name('gtx-cli');
program.parse();
