import { describe, expect, it } from 'vitest';
import { serializeLocaleTwinValue } from '../../internal';

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

/** What a browser evaluating the expression gets (JSON is valid JS). */
function evaluate(expression: string): unknown {
  return JSON.parse(expression);
}

describe('serializeLocaleTwinValue', () => {
  it('produces a JS array expression of the locale and the content', () => {
    expect(serializeLocaleTwinValue('fr', 'Bonjour {name}')).toBe(
      '["fr","Bonjour {name}"]'
    );
  });

  it('keeps minified JSX content as an object tree', () => {
    const content = ['こんにちは ', { t: 'b', i: 1, c: '世界' }];
    expect(evaluate(serializeLocaleTwinValue('ja', content))).toEqual([
      'ja',
      content,
    ]);
  });

  it('escapes quotes, backslashes and line terminators so the expression is valid in any JS parser', () => {
    const text = `a${LS}b${PS}c "double" 'single' \`tick\` \\ </script>`;
    const expression = serializeLocaleTwinValue('en', text);
    expect(expression).not.toContain(LS);
    expect(expression).not.toContain(PS);
    expect(expression).toContain('a\\u2028b\\u2029c');
    expect(evaluate(expression)).toEqual(['en', text]);
    // Evaluated as JS source, not only as JSON
    expect(new Function(`return ${expression}`)()).toEqual(['en', text]);
  });
});
