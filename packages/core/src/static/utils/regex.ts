import { VAR_IDENTIFIER } from './constants';

// Regex  for _gt_# select
export const GT_INDEXED_IDENTIFIER_REGEX = new RegExp(
  `^${VAR_IDENTIFIER}\\d+$`
);
