import { describe, expect, it } from 'vitest';
import {
  estimateDisplayWidth,
  fitLocaleOptionLabel,
} from '../localePromptLayout.js';

// `│  ◻ ` plus a spare column.
const rowWidth = (label: string) => 6 + estimateDisplayWidth(label);

describe('fitLocaleOptionLabel', () => {
  const option = {
    value: 'es-US',
    label: 'es-US  Spanish (United States) / español (Estados Unidos)',
  };

  it('keeps labels that already fit', () => {
    expect(fitLocaleOptionLabel(option, '', 100)).toBe(option);
  });

  it('truncates long labels to one terminal row', () => {
    const { label } = fitLocaleOptionLabel(option, 'es', 50);
    expect(label).toBe('es-US  Spanish (United States) / español (E…');
    expect(rowWidth(label!)).toBeLessThanOrEqual(50);
  });

  it('keeps the code and the matching end when the search falls in the cut', () => {
    const { label } = fitLocaleOptionLabel(option, 'Unidos', 50);
    expect(label).toBe('es-US  …d States) / español (Estados Unidos)');
    expect(rowWidth(label!)).toBeLessThanOrEqual(50);
  });

  it('keeps the full label when no cut keeps the search visible', () => {
    expect(fitLocaleOptionLabel(option, 'states) / español (estados', 30)).toBe(
      option
    );
  });

  it('counts wide characters as two columns and leaves room for hints', () => {
    const { label } = fitLocaleOptionLabel(
      { value: 'zh-HK', label: 'zh-HK  中文（中國香港特別行政區）' },
      '',
      24
    );
    expect(label).toBe('zh-HK  中文（中國…');
    expect(rowWidth(label!)).toBeLessThanOrEqual(24);

    const alias = fitLocaleOptionLabel(
      {
        value: 'my-alias',
        label: 'my-alias-with-a-long-name',
        hint: 'custom mapping',
      },
      '',
      40
    );
    expect(rowWidth(`${alias.label} (${alias.hint})`)).toBeLessThanOrEqual(40);
  });
});
