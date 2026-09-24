// Entry point for binaries

import { main } from '../index.js';
import { loadEnv } from '../utils/loadEnv.js';
import { program } from 'commander';

loadEnv();

main(program);
program.parse();
