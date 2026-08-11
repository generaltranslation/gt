import { describe, expect, it } from 'vitest';
import { instrumentSource } from '../instrumentSource';

describe('instrumentSource', () => {
  it('adds locations to aliased and namespace T components without reprinting JSX', () => {
    const code = `import { T as Translate } from 'gt-react';
import * as GT from 'gt-next';

export default () => (
  <>
    <Translate>  keep   this whitespace </Translate>
    <GT.T><span>nested</span></GT.T>
  </>
);
`;
    const result = instrumentSource({
      code,
      file: '/repo/example.tsx',
      cwd: '/repo',
    });

    expect(result).toContain(
      '<Translate __gtRuntimeSeedSource={{ file: "example.tsx", line: 6, column: 5 }}>  keep   this whitespace </Translate>'
    );
    expect(result).toContain(
      '<GT.T __gtRuntimeSeedSource={{ file: "example.tsx", line: 7, column: 5 }}><span>nested</span></GT.T>'
    );
  });

  it('does not instrument unrelated T components', () => {
    const code = 'const T = () => null; export default () => <T>Hello</T>;';
    expect(
      instrumentSource({ code, file: '/repo/example.tsx', cwd: '/repo' })
    ).toBe(code);
  });
});
