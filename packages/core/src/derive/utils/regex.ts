import { RESERVED_NAME_PREFIX } from '@generaltranslation/icu/internal';

// Regex  for _gt_# select
export const GT_INDEXED_IDENTIFIER_REGEX = new RegExp(
  `^${RESERVED_NAME_PREFIX}\\d+$`
);

export const GT_UNINDEXED_IDENTIFIER_REGEX = new RegExp(
  `^${RESERVED_NAME_PREFIX}$`
);
