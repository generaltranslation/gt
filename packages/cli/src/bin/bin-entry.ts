// Entry point for binaries

import { main } from '../index.js';
import dotenv from 'dotenv';
import { program } from 'commander';
// Statically bundle the migrate engine into the compiled binary and register
// it for the loader. The CLI loads @generaltranslation/migrate on demand (see
// cli/commands/migrateEngineLoader.ts) and keeps it external in the npm build,
// so it is never in the CLI tarball. A standalone binary has no tarball-size
// concern and no npm to fetch from, so it must carry the engine. Assigning it
// onto globalThis is an observable side effect `bun build --compile` cannot
// tree-shake away (the engine is sideEffects:false), so the engine is always
// embedded; the loader reads this global before any other resolution. This
// module is a binary-only compilation root (the npm package runs dist/main.js
// and never loads it), so it is inert for npm users.
import * as migrateEngine from '@generaltranslation/migrate';
import { BUNDLED_MIGRATE_ENGINE } from '../cli/commands/migrateEngineLoader.js';

(globalThis as Record<symbol, unknown>)[BUNDLED_MIGRATE_ENGINE] = migrateEngine;

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });
dotenv.config({ path: '.env.production', override: true });

main(program);
program.parse();
