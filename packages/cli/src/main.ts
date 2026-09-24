#!/usr/bin/env node

// Non-binary router - directly runs main.ts
import { main } from './index.js';
import { loadEnv } from './utils/loadEnv.js';
import { program } from 'commander';

loadEnv();

main(program);
program.parse();
