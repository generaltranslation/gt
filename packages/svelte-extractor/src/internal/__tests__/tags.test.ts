import { describe, expect, it } from 'vitest';
import { findSvelteTags } from '../../index.js';

const find = (source: string) =>
  findSvelteTags(source, ['script', 'style']).map(({ name, content }) => ({
    name,
    content: content && source.slice(content.start, content.end),
  }));

describe('findSvelteTags', () => {
  it('finds elements with attributes, and self-closing elements', () => {
    expect(
      find(
        `<script lang="ts" module>a</script><p>x</p><style a='>' b=c d/>` +
          `<style global>b</style>`
      )
    ).toEqual([
      { name: 'script', content: 'a' },
      { name: 'style', content: undefined },
      { name: 'style', content: 'b' },
    ]);
  });

  it('skips elements inside comments', () => {
    expect(find('<!-- <style>a</style> --><style>b</style>')).toEqual([
      { name: 'style', content: 'b' },
    ]);
  });

  it('does not match other tag names', () => {
    expect(find('<styles>a</styles><scripts/>')).toEqual([]);
  });

  it('ends a tag at /> when an unquoted value is not closed', () => {
    expect(find('<style a=b/>x')).toEqual([
      { name: 'style', content: undefined },
    ]);
  });

  it('finds an element after an unclosed comment or element', () => {
    expect(find('<!-- <style a="<style>b</style>')).toEqual([
      { name: 'style', content: 'b' },
    ]);
  });

  it.each(['<!--', '<style ', '<style>', '<style a=b ', '<style !=" !=" '])(
    'scans repeated %j in linear time',
    (unit) => {
      // A quadratic scan would take over a minute; the bound leaves room for slow CI runners.
      const start = performance.now();
      expect(findSvelteTags(unit.repeat(50_000), ['style'])).toEqual([]);
      expect(performance.now() - start).toBeLessThan(5000);
    }
  );
});
