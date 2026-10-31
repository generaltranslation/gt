import {
  UNSTABLE_GT_HELPER_NAMES,
  type UnstableGTHelperName,
} from 'generaltranslation/internal';
import { describe, expect, it } from 'vitest';
import * as unstable from '../../unstable';

// Framework entries provide these; gt-i18n/unstable exports every other name.
const FRAMEWORK_HOOKS: readonly UnstableGTHelperName[] = ['useGT', 'getGT'];

describe('UNSTABLE_GT_HELPER_NAMES', () => {
  it('names exports of gt-i18n/unstable', () => {
    for (const name of UNSTABLE_GT_HELPER_NAMES) {
      if (!FRAMEWORK_HOOKS.includes(name)) {
        expect(unstable).toHaveProperty(name);
      }
    }
  });
});
