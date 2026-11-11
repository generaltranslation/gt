import { describe, expect, test } from 'vitest';
import { ENTRY, analyzeProject } from '../helpers/project.js';

describe('usage context', () => {
  test('position, scope, JSX context and resolution', async () => {
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
        expression: 'm.close()',
        line: 3,
        column: 30,
        endLine: 3,
        scope: 'Cart',
        element: { element: 'button', attribute: 'aria-label' },
        resolution: ['src/paraglide/messages.js'],
      },
      {
        target: 'message',
        name: 'cart_items',
        kind: 'call',
        expression: 'm.cart_items({ count: n })',
        line: 3,
        column: 42,
        endLine: 3,
        scope: 'Cart',
        element: { element: 'button' },
        resolution: ['src/paraglide/messages.js'],
      },
    ]);
  });

  test('scope names through memo() and multi-line calls', async () => {
    const usages = await analyzeProject({
      [ENTRY]: [
        `import { m } from "./paraglide/messages.js";`,
        `const Tos = memo(() => m.greeting({`,
        `  name: "a",`,
        `}));`,
      ].join('\n'),
    });
    expect(usages[0]).toMatchObject({ scope: 'Tos', line: 2, endLine: 4 });
  });

  test('columns count UTF-16 code units after non-ASCII text', async () => {
    const usages = await analyzeProject({
      [ENTRY]: `import { m } from "./paraglide/messages.js";\nconst x = "héllo 👋"; m.a();`,
    });
    expect(usages[0]).toMatchObject({ line: 2, column: 23 });
  });
});
