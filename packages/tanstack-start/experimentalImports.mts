import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(packageDir, 'src');
const LOCALE_ROUTING_MODULE = 'gt-tanstack-start/internal/localeRouting';
const experimentalLocaleRouting = path.join(
  sourceDir,
  'experimental/internal/localeRouting.ts'
);
const regularServerSetup = path.join(sourceDir, 'setup/initializeGT.server');
const experimentalServerSetup = path.join(
  sourceDir,
  'experimental/setup/initializeGT.server.ts'
);

/**
 * The experimental (locale twin) entry points reuse the regular modules,
 * built against the locale twin versions of what they import: `gt-react`
 * becomes `gt-react/experimental`, the locale routing module the wrapper
 * that keeps its navigating locale switch, and the server setup its locale
 * twin copy. The rewrite happens in the source, before the bundler resolves
 * (and externalizes) the specifiers.
 *
 * Used by the build (tsdown.config.mts, experimental entries) and by the
 * tests of `src/experimental` (vitest.config.ts), so both run the same code.
 */
export const experimentalImports = {
  name: 'gt-tanstack-start:experimental-imports',
  transform(code: string, id: string) {
    const file = id.split('?')[0];
    if (
      !file.startsWith(sourceDir) ||
      file.includes(`${path.sep}__tests__${path.sep}`) ||
      file === experimentalLocaleRouting
    ) {
      return null;
    }
    const rewritten = code
      .replace(/(from\s*)(['"])gt-react\2/g, '$1$2gt-react/experimental$2')
      .replace(
        new RegExp(`(from\\s*)(['"])${LOCALE_ROUTING_MODULE}\\2`, 'g'),
        `$1$2${experimentalLocaleRouting}$2`
      )
      .replace(
        /(from\s*)(['"])(\.{1,2}\/[^'"]*setup\/initializeGT\.server)\2/g,
        (match, from: string, quote: string, specifier: string) =>
          path.resolve(path.dirname(file), specifier) === regularServerSetup
            ? `${from}${quote}${experimentalServerSetup}${quote}`
            : match
      );
    return rewritten === code ? null : { code: rewritten, map: null };
  },
};
