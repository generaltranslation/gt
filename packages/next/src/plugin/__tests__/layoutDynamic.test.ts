import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  layoutMayMakeStatic,
  layoutsMayMakePageStatic,
} from '../layoutDynamic';

const LAYOUT =
  'export default function Layout({ children }) { return children; }';

describe('layoutMayMakeStatic', () => {
  it.each([
    ['no dynamic', LAYOUT],
    ["const dynamic = 'auto'", `export const dynamic = 'auto';\n${LAYOUT}`],
    [
      "const dynamic = 'force-dynamic', without a semicolon",
      `export const dynamic = "force-dynamic"\n\n${LAYOUT}`,
    ],
    [
      "const dynamic = 'force-dynamic' before a comment",
      `export const dynamic = 'force-dynamic' // the locale is in a cookie\n${LAYOUT}`,
    ],
    [
      'next/dynamic imported and called',
      `import dynamic from 'next/dynamic';\nconst Chart = dynamic(() => import('./Chart'));\nconst Map = dynamic<Props>(() => import('./Map'));\n${LAYOUT}`,
    ],
  ])('is false with %s', (_name, code) => {
    expect(layoutMayMakeStatic(code)).toBe(false);
  });

  it.each([
    [
      "const dynamic = 'force-static'",
      "export const dynamic = 'force-static';",
    ],
    ["const dynamic = 'error'", "export const dynamic = 'error'"],
    ['a template literal', 'export const dynamic = `auto`;'],
    ['a variable', 'export const dynamic = mode;'],
    ["let dynamic = 'auto'", "export let dynamic = 'auto';"],
    ['an expression', "export const dynamic = 'auto' + suffix;"],
    [
      'an expression on the next line',
      "export const dynamic = 'auto'\n+ suffix",
    ],
    [
      'an expression after a comment',
      "export const dynamic = 'auto' // ;\n+ suffix",
    ],
    [
      'a second declarator',
      "export const revalidate = 0, dynamic = 'force-static';",
    ],
    [
      'an export of a local',
      "const dynamic = 'force-static';\nexport { dynamic };",
    ],
    [
      'an export as dynamic',
      "const mode = 'force-static';\nexport { mode as dynamic };",
    ],
    ['a re-export', "export { dynamic } from './config';"],
    ['export *', "export * from './config';"],
    ['a function', 'export function dynamic() {}'],
    [
      'an export of next/dynamic',
      "import dynamic from 'next/dynamic';\nexport { dynamic };",
    ],
  ])('is true with %s', (_name, code) => {
    expect(layoutMayMakeStatic(`${code}\n${LAYOUT}`)).toBe(true);
  });
});

describe('layoutsMayMakePageStatic', () => {
  let appDir: string;
  beforeEach(() => {
    appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-next-layouts-'));
  });
  afterEach(() => {
    fs.rmSync(appDir, { recursive: true, force: true });
  });

  const FORCE_STATIC = "export const dynamic = 'force-static';";
  const EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

  it.each<
    [
      name: string,
      layouts: Record<string, string>,
      pageId: string,
      pageExtensions: string[],
      expected: boolean,
    ]
  >([
    [
      'force-static in the root layout',
      { 'layout.tsx': FORCE_STATIC },
      'app/orders/page',
      EXTENSIONS,
      true,
    ],
    [
      'force-static in the layout of the page',
      { 'orders/layout.js': FORCE_STATIC },
      'app/orders/page',
      EXTENSIONS,
      true,
    ],
    [
      'force-static in the layout of a route group',
      { '(shop)/layout.tsx': FORCE_STATIC },
      'app/(shop)/cart/page',
      EXTENSIONS,
      true,
    ],
    [
      'force-static in the root layout of the root page',
      { 'layout.tsx': FORCE_STATIC },
      'app/page',
      EXTENSIONS,
      true,
    ],
    [
      "'force-dynamic' and 'auto' in layouts",
      {
        'layout.tsx': "export const dynamic = 'force-dynamic';",
        'orders/layout.tsx': "export const dynamic = 'auto';",
      },
      'app/orders/page',
      EXTENSIONS,
      false,
    ],
    [
      'a template literal in a layout',
      { 'orders/layout.tsx': 'export const dynamic = `force-dynamic`;' },
      'app/orders/page',
      EXTENSIONS,
      true,
    ],
    [
      'next/dynamic imported in a layout',
      {
        'layout.tsx': `import dynamic from 'next/dynamic';\nconst Nav = dynamic(() => import('./Nav'));\n${LAYOUT}`,
      },
      'app/orders/page',
      EXTENSIONS,
      false,
    ],
    ['no layout file', {}, 'app/orders/page', EXTENSIONS, false],
    [
      'force-static in layouts beside and below the page',
      {
        'cart/layout.tsx': FORCE_STATIC,
        'orders/list/layout.tsx': FORCE_STATIC,
      },
      'app/orders/page',
      EXTENSIONS,
      false,
    ],
    [
      'force-static in a layout with a configured page extension',
      { 'layout.page.tsx': FORCE_STATIC },
      'app/orders/page',
      ['page.tsx'],
      true,
    ],
    [
      'force-static in a layout with an extension that is not configured',
      { 'layout.tsx': FORCE_STATIC },
      'app/orders/page',
      ['page.tsx'],
      false,
    ],
  ])('reads %s', (_name, layouts, pageId, pageExtensions, expected) => {
    for (const [file, code] of Object.entries(layouts)) {
      fs.mkdirSync(path.dirname(path.join(appDir, file)), { recursive: true });
      fs.writeFileSync(path.join(appDir, file), code);
    }
    expect(layoutsMayMakePageStatic({ appDir, pageExtensions }, pageId)).toBe(
      expected
    );
  });
});
