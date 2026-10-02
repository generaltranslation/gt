/**
 * End-to-end check of the analysis app in headless Chromium:
 * home page, treemap, search, zoom, bundle switching, build settings, and the
 * live loop (a package dist file changes, the example rebuilds, the size
 * delta shows up, and reverting the change brings the size back).
 *
 * Usage: pnpm test:e2e [--only vite-react] [--screenshots <dir>]
 * Needs a Chromium binary: set CHROMIUM_PATH, or have Playwright's headless
 * shell cached in ~/Library/Caches/ms-playwright.
 */
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { repoRoot } from '../server/workspace.ts';
import type { ExampleState } from '../shared/types.ts';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (name: string) => {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
};
const only = flag('--only');
const screenshots = flag('--screenshots');
const port = 4690 + Math.floor(Math.random() * 100);
const base = `http://localhost:${port}`;
const PROBE_BYTES = 20_000;

function findChromium(): string {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = join(homedir(), 'Library/Caches/ms-playwright');
  const shells = existsSync(cache)
    ? readdirSync(cache)
        .filter((name) => name.startsWith('chromium_headless_shell-'))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    : [];
  for (const shell of shells) {
    const binary = join(
      cache,
      shell,
      'chrome-headless-shell-mac-arm64/chrome-headless-shell'
    );
    if (existsSync(binary)) return binary;
  }
  throw new Error('No Chromium found. Set CHROMIUM_PATH.');
}

let failures = 0;
function check(condition: unknown, message: string) {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

async function shot(page: Page, name: string) {
  if (!screenshots) return;
  mkdirSync(screenshots, { recursive: true });
  await page.screenshot({ path: join(screenshots, `${name}.png`) });
}

/** Reads the server's state for an example (the same data the page gets). */
async function serverState(id: string): Promise<ExampleState> {
  const controller = new AbortController();
  const response = await fetch(`${base}/api/examples/${id}/events`, {
    signal: controller.signal,
  });
  const reader = response.body!.getReader();
  let text = '';
  while (!text.includes('\n\n')) {
    const { value } = await reader.read();
    text += new TextDecoder().decode(value);
  }
  controller.abort();
  return JSON.parse(text.slice('data: '.length, text.indexOf('\n\n')));
}

async function waitForBuild(
  page: Page,
  after: string | null,
  timeout = 240_000
) {
  await page.waitForFunction(
    (previous) => {
      const line = document.querySelector('.status-text');
      const builtAt = line?.getAttribute('data-built-at') ?? '';
      return (
        (line?.textContent ?? '').startsWith('Built at') &&
        builtAt !== '' &&
        builtAt !== previous
      );
    },
    after,
    { timeout }
  );
  return page.getAttribute('.status-text', 'data-built-at');
}

async function bundleSize(page: Page, kind: string) {
  return page.textContent(`[data-testid=bundle-${kind}] .bundle-size`);
}

async function main() {
  const server = spawn('node', ['server/main.ts', '--no-open'], {
    cwd: appDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) =>
    process.stdout.write(`  [server] ${chunk}`)
  );
  server.stderr.on('data', (chunk) =>
    process.stdout.write(`  [server] ${chunk}`)
  );
  await new Promise<void>((resolve) => {
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('running at')) resolve();
    });
  });

  // Start every example from the default build settings, which an earlier
  // session may have changed (settings persist in .cache).
  for (const id of ['next-app', 'tanstack-start', 'vite-react', 'vite-vue']) {
    await fetch(`${base}/api/examples/${id}/settings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ minify: true, treeShake: true }),
    });
  }

  const browser = await chromium.launch({ executablePath: findChromium() });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  let probeFile: string | null = null;
  let probeOriginal = '';
  try {
    console.log('Home');
    await page.goto(base);
    await page.waitForSelector('.example-card');
    const cards = await page.$$eval('.example-card h2', (nodes) =>
      nodes.map((node) => node.textContent)
    );
    check(cards.length === 4, `four example cards (${cards.join(', ')})`);
    await shot(page, '01-home');

    const ids = ['vite-react', 'vite-vue', 'tanstack-start', 'next-app'].filter(
      (id) => !only || id === only
    );
    for (const id of ids) {
      console.log(`Example ${id}`);
      await page.goto(base);
      await page.click(`[data-testid=example-${id}]`);
      check(
        page.url() === `${base}/${id}`,
        'card navigates to the analysis page'
      );
      // Opening an example always rebuilds it once (packages may have changed).
      await waitForBuild(page, null);
      await page.waitForSelector('.tile.leaf');
      const state = await serverState(id);
      for (const kind of ['client', 'server', 'edge'] as const) {
        const report = state.current?.bundles[kind];
        const button = page.locator(`[data-testid=bundle-${kind}]`);
        check(
          (await button.count()) === (report ? 1 : 0),
          `${kind} bundle ${report ? 'listed' : 'not listed'}`
        );
        if (!report) continue;
        await button.click();
        await page.waitForSelector('.tile.leaf');
        const leaves = await page.locator('.tile.leaf').count();
        const gtLeaves = await page.locator('.tile.leaf.gt').count();
        check(
          leaves > 3 && gtLeaves > 0,
          `${kind} treemap draws ${leaves} files, ${gtLeaves} from GT packages`
        );
        await shot(page, `${id}-${kind}`);
      }
      await page.click('[data-testid=bundle-client]');
      check(errors.length === 0, `no page errors (${errors.join(' | ')})`);
    }

    if (!only || only === 'vite-react') {
      console.log('Search and zoom');
      await page.goto(`${base}/vite-react`);
      await page.waitForSelector('.tile.leaf');
      await page.click('button[aria-label="Search files in bundle"]');
      await page.keyboard.type('gt-react');
      const count = await page.textContent('.search-count');
      check(
        /^[1-9]\d* files?$/.test(count ?? ''),
        `search counts matches (${count})`
      );
      check(
        (await page.locator('.tile.leaf.match').count()) > 0,
        'matching files are highlighted'
      );
      check(
        (await page.locator('.tile.leaf.dimmed').count()) > 0,
        'other files are dimmed'
      );
      await shot(page, 'search');
      await page.keyboard.press('Escape');
      check(
        (await page.locator('.tile.leaf.dimmed').count()) === 0,
        'Escape clears the search'
      );

      const group = page.locator('.tile.group.gt').first();
      const key = await group.getAttribute('data-key');
      await group.click({ position: { x: 8, y: 6 } });
      const crumbs = await page.textContent('.crumbs');
      check(
        crumbs?.includes(key!.split('/')[0]!),
        `zooms into ${key} (${crumbs})`
      );
      await shot(page, 'zoom');
      await page.click('.crumbs button:first-child');
      check(
        !(await page.textContent('.crumbs'))?.includes('/'),
        'first crumb zooms back out'
      );

      console.log('Live loop: package dist change');
      const state = await serverState('vite-react');
      const target = state
        .current!.bundles.client!.modules.filter(
          (module) =>
            module.pkg === 'gt-react' && module.path.startsWith('dist/')
        )
        .sort((a, b) => b.bytes - a.bytes)[0]!;
      probeFile = join(repoRoot, 'packages/react', target.path);
      probeOriginal = readFileSync(probeFile, 'utf8');
      const before = await bundleSize(page, 'client');
      const builtBefore = await page.getAttribute(
        '.status-text',
        'data-built-at'
      );
      writeFileSync(
        probeFile,
        `${probeOriginal}\nglobalThis.__gtBundleProbe = ${JSON.stringify('x'.repeat(PROBE_BYTES))};\n`
      );
      await page.waitForFunction(
        () =>
          document
            .querySelector('.status-text')
            ?.textContent?.startsWith('Building'),
        null,
        { timeout: 15_000 }
      );
      check(true, 'a dist write starts a rebuild');
      const builtAfter = await waitForBuild(page, builtBefore);
      const grown = await bundleSize(page, 'client');
      const delta = await page.textContent('[data-testid=delta-client]');
      check(
        delta?.startsWith('+20.'),
        `client delta shows the probe (${before} -> ${grown}, ${delta})`
      );
      check(
        (await page.locator(`.tile.leaf.changed`).count()) >= 1,
        'the changed file is marked'
      );
      await shot(page, 'live-grown');

      writeFileSync(probeFile, probeOriginal);
      probeFile = null;
      await waitForBuild(page, builtAfter);
      const restored = await bundleSize(page, 'client');
      const restoredDelta = await page.textContent(
        '[data-testid=delta-client]'
      );
      check(restored === before, `size returns after revert (${restored})`);
      check(
        restoredDelta?.startsWith('−20.'),
        `negative delta after revert (${restoredDelta})`
      );
      await shot(page, 'live-restored');

      console.log('Live loop: example source change');
      const appFile = join(
        repoRoot,
        'tools/bundle-analysis/examples/vite-react/src/main.tsx'
      );
      const appOriginal = readFileSync(appFile, 'utf8');
      const builtBeforeEdit = await page.getAttribute(
        '.status-text',
        'data-built-at'
      );
      try {
        writeFileSync(
          appFile,
          `${appOriginal}\n// bundle analysis e2e probe\n`
        );
        await page.waitForFunction(
          () =>
            document
              .querySelector('.status-text')
              ?.textContent?.includes('Edited'),
          null,
          { timeout: 15_000 }
        );
        check(true, 'editing example source starts a rebuild');
      } finally {
        writeFileSync(appFile, appOriginal);
      }
      await waitForBuild(page, builtBeforeEdit);

      console.log('Build settings');
      const minified = await bundleSize(page, 'client');
      let built = await page.getAttribute('.status-text', 'data-built-at');
      await page.getByLabel('Minification').uncheck();
      built = await waitForBuild(page, built);
      const unminified = await bundleSize(page, 'client');
      check(
        parseFloat(unminified!) > parseFloat(minified!),
        `unminified is larger (${minified} -> ${unminified})`
      );
      await shot(page, 'unminified');
      await page.getByLabel('Minification').check();
      built = await waitForBuild(page, built);
      await page.getByLabel('Tree shaking').uncheck();
      built = await waitForBuild(page, built);
      const unshaken = await bundleSize(page, 'client');
      check(
        parseFloat(unshaken!) > parseFloat(minified!),
        `no tree shaking is larger (${minified} -> ${unshaken})`
      );
      await page.getByLabel('Tree shaking').check();
      await waitForBuild(page, built);
      check(
        (await bundleSize(page, 'client')) === minified,
        'defaults restore the original size'
      );
    }

    if (!only || only === 'vite-react') {
      console.log('Agent API');
      const guide = await (await fetch(`${base}/llms.txt`)).text();
      check(
        guide.includes('/api/examples/{id}') && guide.includes('`next-app`'),
        'llms.txt documents endpoints and examples'
      );
      const index = (await (await fetch(`${base}/api`)).json()) as {
        endpoints: unknown[];
      };
      check(
        index.endpoints.length >= 5,
        `GET /api lists ${index.endpoints.length} endpoints`
      );
      const summary = (await (
        await fetch(`${base}/api/examples/vite-react?fresh=1`)
      ).json()) as {
        status: string;
        stale: boolean;
        bundles: {
          client?: {
            totalBytes: number;
            gtBytes: number;
            gtPercent: number;
            gtPackages: { name: string }[];
          };
        };
      };
      const client = summary.bundles.client;
      check(
        summary.status === 'idle' &&
          !summary.stale &&
          client !== undefined &&
          client.gtBytes > 0 &&
          client.gtBytes < client.totalBytes,
        `summary reports GT ${client?.gtBytes} of ${client?.totalBytes} bytes (${client?.gtPercent}%)`
      );
      check(
        client?.gtPackages.some((pkg) => pkg.name === 'gt-react'),
        'summary lists gt-react among GT packages'
      );
      const detail = (await (
        await fetch(
          `${base}/api/examples/vite-react/bundles/client?package=gt-react`
        )
      ).json()) as {
        matchedFiles: number;
        files: { package: string }[];
      };
      check(
        detail.matchedFiles > 0 &&
          detail.files.every((file) => file.package === 'gt-react'),
        `package filter returns ${detail.matchedFiles} gt-react files`
      );
      const diff = await fetch(`${base}/api/examples/vite-react/diff/client`);
      check(diff.ok, 'diff endpoint responds');
      const built = (await (
        await fetch(`${base}/api/examples/vite-react/build?wait=1`, {
          method: 'POST',
        })
      ).json()) as { status: string; builtAt: string };
      check(
        built.status === 'idle' && built.builtAt !== null,
        `POST build?wait=1 returns the new build (${built.builtAt})`
      );
      const missing = await fetch(
        `${base}/api/examples/vite-react/bundles/edge`
      );
      check(
        missing.status === 404,
        'a bundle the example does not emit returns 404'
      );
      const unknown = await fetch(`${base}/api/examples/nope`);
      check(unknown.status === 404, 'an unknown example returns 404');
    }

    console.log('Phone width');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(base);
    await page.waitForSelector('.example-card');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    check(!overflow, 'no horizontal scroll at 390px');
    await shot(page, 'phone-home');

    check(
      errors.length === 0,
      `no page errors overall (${errors.join(' | ')})`
    );
  } catch (error) {
    console.log(
      `  status at failure: ${await page.textContent('.status-text').catch(() => '?')}`
    );
    await shot(page, 'failure');
    throw error;
  } finally {
    if (probeFile) writeFileSync(probeFile, probeOriginal);
    await browser.close();
    server.kill('SIGTERM');
  }

  console.log(
    failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
