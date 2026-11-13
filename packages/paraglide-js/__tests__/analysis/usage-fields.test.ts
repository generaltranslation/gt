import { describe, expect, test } from 'vitest';
import { ENTRY, OUTDIR, analyzeProject } from '../helpers/project.js';

describe('usage fields', () => {
  test('position and target file', async () => {
    const usages = await analyzeProject({
      [ENTRY]: [
        `import { m } from "./paraglide/messages.js";`,
        `export function Cart({ n }: { n: number }) {`,
        `  return <button aria-label={m.close()}>{m.cart_items({ count: n })}</button>;`,
        `}`,
      ].join('\n'),
    });
    expect(usages.map(({ start: _s, end: _e, ...rest }) => rest)).toEqual([
      {
        target: 'message',
        name: 'close',
        kind: 'call',
        line: 3,
        column: 30,
        endLine: 3,
        targetFile: `${OUTDIR}/messages.js`,
      },
      {
        target: 'message',
        name: 'cart_items',
        kind: 'call',
        line: 3,
        column: 42,
        endLine: 3,
        targetFile: `${OUTDIR}/messages.js`,
      },
    ]);
  });

  test('a multi-line call ends on its last line', async () => {
    const usages = await analyzeProject({
      [ENTRY]: [
        `import { m } from "./paraglide/messages.js";`,
        `const Tos = memo(() => m.greeting({`,
        `  name: "a",`,
        `}));`,
      ].join('\n'),
    });
    expect(usages[0]).toMatchObject({ line: 2, endLine: 4 });
  });

  test('columns count UTF-16 code units after non-ASCII text', async () => {
    const usages = await analyzeProject({
      [ENTRY]: `import { m } from "./paraglide/messages.js";\nconst x = "héllo 👋"; m.a();`,
    });
    expect(usages[0]).toMatchObject({ line: 2, column: 23 });
  });
});
