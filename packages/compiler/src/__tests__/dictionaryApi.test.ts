/**
 * The dictionary API (useTranslations/getTranslations from <lib>/compat) is
 * keyed by id, so the compiler leaves it alone. It must not disturb the
 * hashing of native calls in the same file.
 */
import { describe, expect, it } from 'vitest';
import { transformWithPlugin } from './transformWithPlugin';

describe('dictionary API', () => {
  it('leaves useTranslations() untouched next to a hashed useGT()', async () => {
    const output = await transformWithPlugin(
      undefined,
      `
      import { useGT } from 'gt-react';
      import { useTranslations } from 'gt-react/compat';
      const t = useTranslations('user');
      const gt = useGT();
      t('name');
      gt("Hello world");
    `
    );
    expect(output).not.toBeNull();
    expect(output).toContain('"$_hash": "');
    expect(output).toMatch(/useTranslations\(["']user["']\)/);
    expect(output).toMatch(/\bt\(["']name["']\)/);
  });
});
