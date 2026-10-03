import type { ExampleSummary } from '../shared/types.ts';

/** Endpoints, listed once for both `GET /api` and `/llms.txt`. */
const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/examples',
    description:
      'Example apps, the bundles each emits, and the last measured client size.',
  },
  {
    method: 'GET',
    path: '/api/examples/{id}?fresh=1',
    description:
      'Size of every bundle: total, gzip, GT bytes and percent, change since the previous build, GT packages, and the 10 largest packages. fresh=1 rebuilds first when sources changed and waits; wait=1 only waits for a running build.',
  },
  {
    method: 'GET',
    path: '/api/examples/{id}/bundles/{kind}?package=&q=&limit=50',
    description:
      'Packages in one bundle (client, server, or edge) by size. With package=<name>, that package’s files. With q=<text>, files whose package/path contains the text.',
  },
  {
    method: 'GET',
    path: '/api/examples/{id}/diff/{kind}',
    description:
      'Files whose size changed between the previous and current build, largest change first.',
  },
  {
    method: 'POST',
    path: '/api/examples/{id}/build?wait=1',
    description:
      'Run the production build now. wait=1 returns the new measurement.',
  },
  {
    method: 'POST',
    path: '/api/examples/{id}/settings?wait=1',
    description:
      'Body {"minify": boolean, "treeShake": boolean}. Changes the build settings and rebuilds. Settings persist until changed back.',
  },
] as const;

export function apiIndex(baseUrl: string) {
  return {
    description:
      'Bundle analysis for the General Translation SDKs. Sizes are uncompressed bytes of emitted JavaScript, attributed to packages through source maps.',
    guide: `${baseUrl}/llms.txt`,
    endpoints: ENDPOINTS.map((endpoint) => ({
      ...endpoint,
      url: `${baseUrl}${endpoint.path}`,
    })),
  };
}

export function agentGuide(baseUrl: string, examples: ExampleSummary[]) {
  const rows = examples
    .map(
      (example) =>
        `| \`${example.id}\` | ${example.pkg} | ${example.framework} | ${example.bundles.join(', ')} |`
    )
    .join('\n');
  const endpoints = ENDPOINTS.map(
    (endpoint) =>
      `- \`${endpoint.method} ${baseUrl}${endpoint.path}\`: ${endpoint.description}`
  ).join('\n');

  return `# GT bundle analysis

Measures how much JavaScript the General Translation packages (gt-next,
gt-react, gt-tanstack-start, gt-vue, gt-i18n, generaltranslation,
@generaltranslation/*) add to real apps. Each example is a workspace app that
uses the packages' local \`dist\` output. A production build is run and every
emitted byte is attributed to the package it came from through source maps.

## Examples

| id | package | framework | bundles |
| --- | --- | --- | --- |
${rows}

## Endpoints

All responses are JSON. Sizes are bytes.

${endpoints}

## Typical use

Measure GT's share of the Next.js client bundle:

    curl -s '${baseUrl}/api/examples/next-app?fresh=1'

Read \`bundles.client.gtBytes\` and \`bundles.client.gtPercent\`.

Check the effect of a source change in packages/react:

1. Rebuild the package (\`pnpm --filter gt-react build\`), or let a running
   \`pnpm watch\` do it. The server rebuilds open examples when dist changes.
2. \`curl -s '${baseUrl}/api/examples/vite-react?fresh=1'\` and read
   \`bundles.client.change\`.
3. \`curl -s '${baseUrl}/api/examples/vite-react/diff/client'\` lists the
   files that grew or shrank.

Find where a symbol's package lands:

    curl -s '${baseUrl}/api/examples/next-app/bundles/client?package=gt-i18n'

## Notes

- Bundle totals count every emitted JS file, including lazy chunks that a
  visitor may never download. CSS is not counted.
- Next.js maps GT bytes to the packages' src files; Vite examples map to dist
  files.
- A build takes about 1 second for Vite examples and 10 to 30 seconds for
  Next.js.
`;
}
