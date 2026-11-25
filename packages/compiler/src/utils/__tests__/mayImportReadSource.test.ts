import { describe, expect, it } from 'vitest';
import { GT_MESSAGE_IMPORT_SOURCES } from 'generaltranslation/internal';
import { GT_IMPORT_SOURCES } from '../constants/gt/constants';
import {
  REACT_FUNCTION_VALUES,
  REACT_IMPORT_SOURCES,
} from '../constants/react/constants';
import { mayImportReadSource } from '../mayImportReadSource';

const QUOTES = ["'", '"'];

describe('mayImportReadSource', () => {
  it.each(
    [
      ...new Set([
        ...Object.values(GT_IMPORT_SOURCES),
        ...GT_MESSAGE_IMPORT_SOURCES,
      ]),
    ].flatMap((source) => QUOTES.map((quote) => [quote + source + quote]))
  )('reads a module that imports from %s', (source) => {
    expect(mayImportReadSource(`import { T } from ${source};`)).toBe(true);
  });

  it.each(
    [
      ...Object.values(REACT_IMPORT_SOURCES),
      '@emotion/react/jsx-runtime',
      'preact/jsx-dev-runtime',
      '../runtime/jsx-runtime',
      './elements',
    ].flatMap((source) =>
      REACT_FUNCTION_VALUES.map((name) => [name, `'${source}'`])
    )
  )('reads a module that imports %s from %s', (name, source) => {
    expect(mayImportReadSource(`import { ${name} as _ } from ${source};`)).toBe(
      true
    );
  });

  it.each([
    ['an escape in a source', String.raw`import { T } from 'gt-react';`],
    [
      'an escape in a name',
      String.raw`import { jsx } from 'react/jsx-runtime';`,
    ],
    ['an escape anywhere', String.raw`export const lines = text.split('\n');`],
  ])('reads a module with %s', (_name, code) => {
    expect(mayImportReadSource(code)).toBe(true);
  });

  it.each([
    ['no import', `export const total = (a, b) => a + b;`],
    ['other imports', `import { clamp } from './math';\nexport { clamp };`],
    [
      'React without a JSX function',
      `import { useState } from 'react';\nexport const useOpen = () => useState(false);`,
    ],
    [
      'a package whose name starts with a source',
      `import { useQuery } from 'react-query';\nimport { helper } from 'gt-react-helpers';`,
    ],
    [
      'a source outside a string',
      `// see gt-react\nexport const gtReact = 'gt react';`,
    ],
  ])('skips a module with %s', (_name, code) => {
    expect(mayImportReadSource(code)).toBe(false);
  });
});
