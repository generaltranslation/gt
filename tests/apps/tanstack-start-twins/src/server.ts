/// <reference types="@generaltranslation/compiler/experimental/locale-twins-manifest" />
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import { createServerEntry } from '@tanstack/react-start/server-entry';
import {
  createLocaleTwinAssets,
  type LocaleTwinAssets,
} from 'gt-tanstack-start/experimental';
import { manifest } from 'virtual:gt-locale-twins-manifest';

// Points the document's scripts, module preloads, and the router manifest at
// the request locale's twins.
const twinAssets = createLocaleTwinAssets({ manifest });

const fetch = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets:
    process.env.GT_TWINS_TEST_MISMATCH === '1'
      ? withMismatchControl(twinAssets)
      : twinAssets,
});

export default createServerEntry({ fetch });

/**
 * Test-only hydration mismatch control (spec §9.5), enabled by
 * `GT_TWINS_TEST_MISMATCH=1`: `?__gt_twin_locale=<locale>` serves that
 * locale's twins while the server renders the request locale, so the browser
 * must report a hydration error.
 */
function withMismatchControl(assets: LocaleTwinAssets): LocaleTwinAssets {
  const originals = new Map<string, string>();
  for (const twins of Object.values(manifest?.twins ?? {})) {
    for (const [original, twin] of Object.entries(twins)) {
      originals.set(twin, original);
    }
  }
  return {
    cache: false,
    createTransform(ctx) {
      const transform = assets.createTransform(ctx);
      if (ctx.warmup) return transform;
      const locale = new URL(ctx.request.url).searchParams.get(
        '__gt_twin_locale'
      );
      const twins = locale ? manifest?.twins[locale] : undefined;
      if (!twins) return transform;
      return (asset) => {
        const url = transform(asset);
        const fileName = [...originals.keys()].find((twin) =>
          url.endsWith(`/${twin}`)
        );
        if (!fileName) return url;
        const twin = twins[originals.get(fileName)!];
        return `${url.slice(0, url.length - fileName.length)}${twin}`;
      };
    },
  };
}
