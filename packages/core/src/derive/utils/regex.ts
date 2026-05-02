import { VAR_IDENTIFIER } from './constants';

// Regex for _gt_# select identifiers.
export const GT_INDEXED_IDENTIFIER_REGEX = new RegExp(
  `^${VAR_IDENTIFIER}\\d+$`
);

export const GT_UNINDEXED_IDENTIFIER_REGEX = new RegExp(`^${VAR_IDENTIFIER}$`);
