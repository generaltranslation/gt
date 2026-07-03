// Keep these in sync with @formatjs/icu-messageformat-parser's TYPE enum.
export const ICU_TYPE = {
  literal: 0,
  argument: 1,
  select: 5,
  plural: 6,
  tag: 8,
} as const;
