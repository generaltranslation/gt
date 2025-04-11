#!/usr/bin/env node

import main from './index';
import dotenv from 'dotenv';

for (const path of [
    ".env",
    ".env.local",
    ".env.production",
    ".env.production.local"
]) {
    dotenv.config({ path, override: true });
};

main();
