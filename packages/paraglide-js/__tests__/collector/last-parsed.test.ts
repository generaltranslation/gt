import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import { createCollector } from '../../lib/compiler/collector/create.js';
import { nodeResolver } from '../../lib/compiler/plugins/node-resolver.js';
import { readSnippets, writeProject } from '../plugins/fixture.js';

test("a file that stops parsing (mid-edit) keeps its last version's usages", async () => {
  const root = await writeProject('last-parsed', {
    'src/a.ts': `import { m } from "./paraglide/messages.js";\nexport const a = m.greeting();\n`,
  });
  const warnings: string[] = [];
  const collector = createCollector(
    {},
    {
      root,
      logger: { warn: (message) => void warnings.push(message), info() {} },
    }
  );
  collector.resolver = nodeResolver();
  const usages = ['src/a.ts: export const a = m.greeting();'];
  await collector.scanAll();
  await collector.write();
  expect(await readSnippets(root)).toEqual(usages);

  const file = path.join(root, 'src/a.ts');
  await fs.writeFile(
    file,
    `import { m } from "./paraglide/messages.js";\nexport const a = m.greeting(;\n`
  );
  await collector.updateChangedFileFromPath(file);
  await collector.write();
  expect(await readSnippets(root)).toEqual(usages);
  expect(warnings).toContainEqual(
    expect.stringContaining('src/a.ts does not parse (')
  );
});
