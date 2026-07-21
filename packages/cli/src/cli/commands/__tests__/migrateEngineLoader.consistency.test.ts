import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as engine from '@generaltranslation/migrate';
import semver from 'semver';
import { describe, expect, it } from 'vitest';
import {
  ENGINE_RANGE,
  EXPECTED_INTERFACE_VERSION,
} from '../migrateEngineLoader.js';

// Three values must move together by hand: the CLI's ENGINE_RANGE, the CLI's
// EXPECTED_INTERFACE_VERSION, and the engine's exported
// MIGRATE_INTERFACE_VERSION plus its published version. Nothing else enforces
// the coupling, so this test does: bump the engine's minor line or its
// interface without moving the CLI constants and the monorepo fails here
// instead of stranding users on a range that can never satisfy the CLI.
//
// The interface assertion reads the BUILT engine (the workspace export map
// points at dist/), which CI rebuilds before this suite (turbo `test` depends
// on `build`). A bare local vitest run against a stale engine dist can
// false-pass the interface half; the version half reads package.json straight
// from disk and is build-independent.
describe('engine range and interface version stay coupled', () => {
  it('the workspace engine satisfies ENGINE_RANGE', () => {
    const pkgPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../../migrate/package.json'
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as {
      version: string;
    };
    // The pre-publish version is 0.0.0 and its changeset bumps minor; either
    // the current version or its next minor must land inside the range.
    const nextMinor = semver.inc(pkg.version, 'minor');
    expect(
      semver.satisfies(pkg.version, ENGINE_RANGE) ||
        (nextMinor !== null && semver.satisfies(nextMinor, ENGINE_RANGE))
    ).toBe(true);
  });

  it('the workspace engine speaks the interface version the CLI expects', () => {
    expect(engine.MIGRATE_INTERFACE_VERSION).toBe(EXPECTED_INTERFACE_VERSION);
  });
});
