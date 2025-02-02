#!/usr/bin/env node

import main from 'gt-react-cli';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

main('gt-next');
