// Dumps the samsara CLI's extraction updates (hash → source + dataFormat + metadata).
// Usage: node dump-samsara-updates.mjs <cliDistDir> <projectDir> <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [distDir, projectDir, outFile] = process.argv.slice(2);
process.chdir(projectDir);
const load = (p) => import(pathToFileURL(path.join(distDir, p)).href);
const { generateSettings } = await load('config/generateSettings.js');
const { aggregateInlineTranslations } = await load('translation/stage.js');

const settings = await generateSettings({}, undefined, { requireConfig: true });
const updates = await aggregateInlineTranslations({}, settings, 'gt-next');
const staticIds = new Map();
const out = {};
for (const u of updates) {
  const {
    hash,
    staticId,
    filePaths: _filePaths,
    sourceCode: _sourceCode,
    ...rest
  } = u.metadata;
  let group;
  if (staticId) {
    if (!staticIds.has(staticId))
      staticIds.set(staticId, `derive-${staticIds.size + 1}`);
    group = staticIds.get(staticId);
  }
  out[hash] = {
    source: u.source,
    dataFormat: u.dataFormat,
    ...rest,
    ...(group ? { deriveGroup: group } : {}),
  };
}
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.error(`${Object.keys(out).length} entries`);
