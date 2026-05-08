import { CutoffFormatStyle, ResolvedTerminatorOptions } from './types';

export const DEFAULT_CUTOFF_FORMAT_STYLE: CutoffFormatStyle = 'ellipsis';

export const DEFAULT_TERMINATOR_KEY = 'DEFAULT_TERMINATOR_KEY';

export const TERMINATOR_MAP: Record<
  CutoffFormatStyle,
  Record<string | typeof DEFAULT_TERMINATOR_KEY, ResolvedTerminatorOptions>
> = {
  ellipsis: {
    fr: {
      terminator: '…',
      separator: '\u202F',
    },
    zh: {
      terminator: '……',
      separator: undefined,
    },
    ja: {
      terminator: '……',
      separator: undefined,
    },
    [DEFAULT_TERMINATOR_KEY]: {
      terminator: '…',
      separator: undefined,
    },
  },
  none: {
    [DEFAULT_TERMINATOR_KEY]: {
      terminator: undefined,
      separator: undefined,
    },
  },
};
