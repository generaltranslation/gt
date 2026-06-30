import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

describe('gt-next package exports', () => {
  it('uses RSC-specific declarations for the react-server condition', () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, 'package.json'), 'utf8')
    ) as {
      exports: {
        '.': {
          'react-server': {
            types?: string;
          };
          types: string;
        };
      };
    };

    expect(packageJson.exports['.']['react-server'].types).toBe(
      './dist/index.rsc.d.ts'
    );
    expect(packageJson.exports['.'].types).toBe('./dist/index.types.d.ts');
  });
});
