#!/usr/bin/env node

import { main } from './index.js';
import dotenv from 'dotenv';
import { program } from 'commander';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

main(program);
program.parse();
