import { describe, expect, it } from 'vitest';
import { BaseTransformation, InjectionType } from 'generaltranslation/types';
import { parseTransformation } from '../parseTransformation';

const BASE_TRANSFORMATIONS: BaseTransformation[] = [
  'translate-client',
  'translate-server',
  'translate-runtime',
  'variable-variable',
  'variable-currency',
  'variable-datetime',
  'variable-number',
  'variable-relative-time',
  'plural',
  'branch',
  'derive',
];

const MARKERS: (InjectionType | undefined)[] = [
  undefined,
  'automatic',
  'manual',
];

describe('parseTransformation', () => {
  const cases = BASE_TRANSFORMATIONS.flatMap((base) =>
    MARKERS.map((marker) => ({
      tag: marker ? `${base}-${marker}` : base,
      base,
      marker,
    }))
  );

  it.each(cases)('$tag', ({ tag, base, marker }) => {
    const { prefix, suffix, injectionType } = parseTransformation(tag);
    expect(prefix).not.toContain('-');
    expect(suffix === undefined ? prefix : `${prefix}-${suffix}`).toBe(base);
    expect(injectionType).toBe(marker ?? 'manual');
  });

  // `relative-time` is the only hyphenated suffix in the union.
  it('keeps a hyphenated suffix intact', () => {
    expect(parseTransformation('variable-relative-time').suffix).toBe(
      'relative-time'
    );
  });

  it('ignores surrounding whitespace', () => {
    expect(parseTransformation('variable-datetime-automatic ')).toEqual({
      prefix: 'variable',
      suffix: 'datetime',
      injectionType: 'automatic',
    });
  });

  it('reads the injection marker after a hyphenated suffix', () => {
    expect(
      parseTransformation('variable-relative-time-automatic').injectionType
    ).toBe('automatic');
  });
});
