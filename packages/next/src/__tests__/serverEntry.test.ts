import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function readSource(path: string): string {
  return readFileSync(join(packageRoot, path), 'utf8');
}

describe('server entry', () => {
  it('does not re-export client-only selectors from the server entry', () => {
    const indexServer = readSource('src/index.server.ts');

    expect(indexServer).not.toContain('./index.client');
  });

  it('does not import gt-react/client during provider module evaluation', () => {
    const clientWrapper = readSource('src/provider/ClientProviderWrapper.tsx');

    expect(clientWrapper).not.toMatch(
      /import\s+\{[^}]*ClientProvider[^}]*\}\s+from\s+['"]gt-react\/client['"]/
    );
    expect(clientWrapper).toContain("require('gt-react/client')");
  });
});
