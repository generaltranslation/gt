import fs from 'node:fs';
import path from 'node:path';

/** Where the SWC plugin looks for pages, as withGTConfig() resolves it. */
export type PageSegments = {
  appDir: string;
  pageExtensions: string[];
};

const DYNAMIC = /(?<![\w$])dynamic(?![\w$])/g;
const EXPORT_ALL = /\bexport\s*\*/;

// Each use of the name `dynamic` that exports nothing, or exports a value that
// leaves the page dynamic: anything else may export it.
const HARMLESS_DYNAMIC = [
  /\bexport\s+const\s+dynamic\s*=\s*(["'])(?:auto|force-dynamic)\1(?=[ \t]*(?:\/\/[^\n]*(?:\n|$))?\s*(?:;|$|(?:export|import|const|let|var|function|async|class|type|interface|enum|declare)\b))/g,
  /\bimport\s+dynamic\s+from\s*(["'])next\/dynamic\1/g,
  /(["'])next\/dynamic\1/g,
  /(?<!\bfunction\s*\*?\s*)(?<![\w$])dynamic\s*(?:<[^<>()]*>)?\s*\(/g,
];

/**
 * Whether a layout's code may export `dynamic` as anything but the string
 * literal `'auto'` or `'force-dynamic'`, which Next.js reads for every page
 * below it. Uses of the name it cannot tell from an export count.
 */
export function layoutMayMakeStatic(code: string): boolean {
  if (EXPORT_ALL.test(code)) return true;
  const harmless = HARMLESS_DYNAMIC.flatMap((pattern) =>
    Array.from(code.matchAll(pattern), (match) => [
      match.index,
      match.index + match[0].length,
    ])
  );
  return Array.from(code.matchAll(DYNAMIC)).some(
    ({ index, 0: name }) =>
      !harmless.some(
        ([start, end]) => start <= index && index + name.length <= end
      )
  );
}

/**
 * Whether a layout file in the directory of the page with this id
 * (`app/orders/page`), or in one above it up to the app directory, may make
 * the page static.
 */
export function layoutsMayMakePageStatic(
  { appDir, pageExtensions }: PageSegments,
  pageId: string
): boolean {
  const directories = path.posix.dirname(pageId).split('/').slice(1);
  return Array.from({ length: directories.length + 1 }).some((_, depth) => {
    const directory = path.join(appDir, ...directories.slice(0, depth));
    return pageExtensions.some((extension) => {
      const layout = path.join(directory, `layout.${extension}`);
      return (
        fs.existsSync(layout) &&
        layoutMayMakeStatic(fs.readFileSync(layout, 'utf8'))
      );
    });
  });
}
