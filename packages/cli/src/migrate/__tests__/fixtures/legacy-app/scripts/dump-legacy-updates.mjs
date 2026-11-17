// Dumps the legacy CLI's extraction updates (source + dataFormat + metadata) keyed by hash.
import fs from 'node:fs';
import { generateSettings } from '../node_modules/gt/dist/config/generateSettings.js';
import { aggregateInlineTranslations } from '../node_modules/gt/dist/translation/stage.js';

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
  out[hash] = {
    dataFormat: u.dataFormat,
    ...rest,
    ...(staticId ? { deriveGroup: deriveGroup(staticId) } : {}),
  };
}
function deriveGroup(staticId) {
  if (!staticIds.has(staticId)) {
    staticIds.set(staticId, `derive-${staticIds.size + 1}`);
  }
  return staticIds.get(staticId);
}

const sorted = Object.fromEntries(
  Object.keys(out)
    .sort()
    .map((k) => [k, out[k]])
);
fs.writeFileSync(
  process.argv[2] ?? 'legacy-metadata.json',
  JSON.stringify(sorted, null, 2) + '\n'
);
console.error(Object.keys(sorted).length, 'entries');
