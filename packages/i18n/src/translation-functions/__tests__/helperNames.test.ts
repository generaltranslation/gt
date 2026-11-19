import {
  GT_MESSAGE_HELPER_NAMES,
  type GTMessageHelperName,
} from 'generaltranslation/internal';
import { describe, expect, it } from 'vitest';
import * as root from '../../index';

// Framework entries provide these; gt-i18n exports every other name.
const FRAMEWORK_HOOKS: readonly GTMessageHelperName[] = ['useGT', 'getGT'];

describe('GT_MESSAGE_HELPER_NAMES', () => {
  it('names exports of gt-i18n', () => {
    for (const name of GT_MESSAGE_HELPER_NAMES) {
      if (!FRAMEWORK_HOOKS.includes(name)) {
        expect(root).toHaveProperty(name);
      }
    }
  });
});
