import { chromium, type Browser, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/** The browser dependency belongs to this workspace; the fixture catalog stays with SWC. */
export async function openParityBrowser() {
  return chromium.launch({
    ...(process.env.GT_PARITY_BROWSER_CHANNEL
      ? { channel: process.env.GT_PARITY_BROWSER_CHANNEL }
      : {}),
    headless: true,
  });
}

type DomNode =
  | string
  | {
      tag: string;
      attributes: Record<string, string>;
      properties: Record<string, string | boolean>;
      style: Record<string, string>;
      children: DomNode[];
    };
export type Snapshot = {
  title: string;
  expectationFailures: string[];
  missing: string[];
  unexpected: string[];
  duplicates: string[];
  cases: Record<string, DomNode | null>;
  hashes: (string | null)[];
  overlay: boolean;
};
type Expectations = {
  title?: string;
  styles?: { selector: string; property: string; value: string }[];
};
export type BrowserRun = {
  snapshots: Record<string, Snapshot>;
  console: { type: string; text: string }[];
  pageErrors: string[];
  failedRequests: {
    url: string;
    failure: string | undefined;
    resourceType: string;
    context: 'ssr' | 'client';
    expected?: 'scripts-disabled';
  }[];
  failedResponses: { url: string; status: number }[];
  failures: string[];
};

async function capture(
  page: Page,
  cases: string[],
  checks: Expectations
): Promise<Snapshot> {
  return page.evaluate(
    ({ expected, checks }) => {
      const styles = [
        'color',
        'backgroundColor',
        'fontWeight',
        'fontStyle',
        'textDecorationLine',
        'paddingLeft',
        'paddingTop',
        'borderLeftWidth',
        'marginTop',
        'whiteSpace',
        'letterSpacing',
        'borderRadius',
        'display',
      ] as const;
      const visitor = {
        snapshot(node: Node): DomNode | null {
          if (node.nodeType === window.Node.TEXT_NODE)
            return node.textContent || '';
          // React's streaming/hydration comments aren't DOM content. Preserve text exactly.
          if (!(node instanceof window.Element)) return null;
          const computed = window.getComputedStyle(node);
          const properties: Record<string, string | boolean> = {};
          if (node instanceof window.HTMLInputElement) {
            properties.value = node.value;
            properties.checked = node.checked;
          } else if (
            node instanceof window.HTMLTextAreaElement ||
            node instanceof window.HTMLSelectElement
          ) {
            properties.value = node.value;
          }
          return {
            tag: node.tagName,
            attributes: Object.fromEntries(
              Array.from(node.attributes, (attribute) => [
                attribute.name,
                attribute.value,
              ]).sort(([a], [b]) => a.localeCompare(b))
            ),
            properties,
            style: Object.fromEntries(
              styles.map((name) => [name, computed[name]])
            ),
            children: Array.from(node.childNodes, visitor.snapshot).filter(
              (child) => child !== null
            ),
          };
        },
      };
      const found = Array.from(document.querySelectorAll('[data-case]'));
      const ids = found.map((element) => element.getAttribute('data-case')!);
      const expectationFailures = [];
      if (checks.title !== undefined && document.title !== checks.title)
        expectationFailures.push(
          `Expected document title ${JSON.stringify(checks.title)}, received ${JSON.stringify(document.title)}`
        );
      for (const check of checks.styles || []) {
        const element = document.querySelector(check.selector);
        const actual = element
          ? window.getComputedStyle(element).getPropertyValue(check.property)
          : undefined;
        if (actual !== check.value)
          expectationFailures.push(
            `${check.selector}: expected ${check.property}=${check.value}, received ${actual}`
          );
      }
      return {
        title: document.title,
        expectationFailures,
        missing: expected.filter((id) => !ids.includes(id)),
        unexpected: ids.filter((id) => !expected.includes(id)),
        duplicates: ids.filter((id, index) => ids.indexOf(id) !== index),
        cases: Object.fromEntries(
          found.map((element) => [
            element.getAttribute('data-case'),
            visitor.snapshot(element),
          ])
        ),
        hashes: found.flatMap((element) =>
          [element, ...element.querySelectorAll('[data-_gt-hash]')]
            .filter((node) => node.hasAttribute('data-_gt-hash'))
            .map((node) => node.getAttribute('data-_gt-hash'))
        ),
        overlay: Boolean(
          document
            .querySelector('nextjs-portal')
            ?.shadowRoot?.querySelector('[data-nextjs-dialog-overlay]')
            ?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        ),
      };
    },
    { expected: cases, checks }
  );
}

/** Capture actual SSR (JavaScript disabled), hydration, and repeated client updates. */
export async function inspectParityApp(
  browser: Browser,
  {
    url,
    cases,
    states,
    directory,
    expectations,
    expectedConsoleErrors = [],
  }: {
    url: string;
    cases: string[];
    states: readonly { name: string }[];
    directory: string;
    expectations: Expectations[];
    expectedConsoleErrors?: readonly 'spread-key'[];
  }
): Promise<BrowserRun> {
  const result: BrowserRun = {
    snapshots: {},
    console: [],
    pageErrors: [],
    failedRequests: [],
    failedResponses: [],
    failures: [],
  };
  const ssr = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 900 },
  });
  const client = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  for (const context of [ssr, client]) {
    context.on('response', (response) => {
      if (response.status() >= 400)
        result.failedResponses.push({
          url: response.url(),
          status: response.status(),
        });
    });
    context.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText;
      const resourceType = request.resourceType();
      // Chromium reports blocked scripts when this context deliberately has
      // JavaScript disabled. Retain that evidence; other request failures,
      // including every client-context CSP failure, still fail the run.
      const scriptsDisabled =
        context === ssr &&
        resourceType === 'script' &&
        /^(?:csp|net::ERR_BLOCKED_BY_CSP)$/.test(failure ?? '');
      result.failedRequests.push({
        url: request.url(),
        failure,
        resourceType,
        context: context === ssr ? 'ssr' : 'client',
        ...(scriptsDisabled && { expected: 'scripts-disabled' as const }),
      });
    });
  }
  await client.tracing.start({
    screenshots: true,
    snapshots: true,
    sources: false,
  });
  const page = await client.newPage();
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type()))
      result.console.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => result.pageErrors.push(String(error)));
  try {
    const serverPage = await ssr.newPage();
    for (let index = 0; index < states.length; index++) {
      const response = await serverPage.goto(`${url}/server?state=${index}`, {
        waitUntil: 'load',
        timeout: 120_000,
      });
      if (response?.status() !== 200)
        result.failures.push(
          `Server state ${index}: HTTP ${response?.status()}`
        );
      await writeFile(
        path.join(directory, `server-${states[index].name}.html`),
        await serverPage.content()
      );
      result.snapshots[`server/${states[index].name}`] = await capture(
        serverPage,
        cases,
        expectations[index]
      );
    }
    const response = await page.goto(url, {
      waitUntil: 'load',
      timeout: 120_000,
    });
    if (response?.status() !== 200) {
      result.failures.push(`Client: HTTP ${response?.status()}`);
      return result;
    }
    await page.locator('[data-hydrated="true"]').waitFor({ timeout: 30_000 });
    // Include a round trip to catch remounts, stale values and key identity regressions.
    for (const [index, state] of [...states, states[0]].entries()) {
      if (index > 0) await page.locator(`[data-state="${state.name}"]`).click();
      await page.locator(`[data-active-state="${state.name}"]`).waitFor();
      result.snapshots[`client/${index}-${state.name}`] = await capture(
        page,
        cases,
        expectations[index % states.length]
      );
    }
    await page.screenshot({
      path: path.join(directory, 'client.png'),
      fullPage: true,
    });
  } catch (error) {
    result.failures.push(String(error));
    await page
      .screenshot({ path: path.join(directory, 'failure.png'), fullPage: true })
      .catch(() => {});
  } finally {
    for (const [stage, snapshot] of Object.entries(result.snapshots)) {
      if (
        snapshot.missing.length ||
        snapshot.unexpected.length ||
        snapshot.duplicates.length ||
        snapshot.overlay
      )
        result.failures.push(
          `${stage}: case inventory or error overlay failed`
        );
      result.failures.push(
        ...snapshot.expectationFailures.map((failure) => `${stage}: ${failure}`)
      );
      if (snapshot.hashes.length === 0)
        result.failures.push(
          `${stage}: no GT hashes rendered in any fixture case`
        );
    }
    result.failures.push(
      ...result.pageErrors,
      ...result.failedRequests
        .filter((request) => !request.expected)
        .map((request) => `Request failed: ${request.url}: ${request.failure}`),
      ...result.failedResponses.map(
        (response) => `HTTP ${response.status}: ${response.url}`
      )
    );
    // Only the key fixture allows React's specific spread-key diagnostic.
    // Retain it in evidence; every other console error fails the run.
    result.failures.push(
      ...result.console
        .filter(
          ({ type, text }) =>
            /hydration|hydrating|server rendered HTML|uncaught|unhandled/i.test(
              text
            ) ||
            (type === 'error' &&
              !(
                expectedConsoleErrors.includes('spread-key') &&
                text.startsWith(
                  'A props object containing a "key" prop is being spread into JSX:'
                ) &&
                text.includes(
                  'React keys must be passed directly to JSX without using spread:'
                )
              ))
        )
        .map(({ text }) => text)
    );
    await client.tracing.stop({ path: path.join(directory, 'trace.zip') });
    await client.close();
    await ssr.close();
  }
  return result;
}
