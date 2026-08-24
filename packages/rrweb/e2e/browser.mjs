// Browser acquisition for the e2e: an existing CDP endpoint when provided
// (GT_RRWEB_E2E_CDP), else launch the system Chrome via playwright-core (the
// 'chrome' channel needs no downloaded browsers).
import { chromium } from 'playwright-core';

export async function getBrowser() {
  const cdp = process.env.GT_RRWEB_E2E_CDP;
  if (cdp) {
    const browser = await chromium.connectOverCDP(cdp);
    return { browser, close: () => browser.close() };
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  return { browser, close: () => browser.close() };
}

export async function newPage(browser) {
  const context = browser.contexts()[0] ?? (await browser.newContext());
  const page = await context.newPage();
  return page;
}
