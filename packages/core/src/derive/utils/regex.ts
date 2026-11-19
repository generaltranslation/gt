import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';

export const GT_UNINDEXED_IDENTIFIER_REGEX = new RegExp(
  `^${RESERVED_NAME_PREFIX}$`
);
