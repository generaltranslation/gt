#!/usr/bin/env node

// Writes the gt.config.json JSON Schemas from the built valibot schemas: the
// hosted one for projects that only use the CLI, and one in each library
// package. Build gt and gt-next first. --check compares instead of writing.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { toJsonSchema } from '@valibot/to-json-schema';

export const configJsonSchemaPath = fileURLToPath(
  new URL('../../../assets/config-schema.json', import.meta.url)
);

/** Users author the input shape; unsupported actions fail instead of being dropped. */
export function generateConfigJsonSchema(schema, definitions) {
  const { $schema, $id, title, description, ...rest } = toJsonSchema(schema, {
    target: 'draft-07',
    typeMode: 'input',
    errorMode: 'throw',
    definitions,
  });
  // Lead with the identifying keywords, as hand-written schemas do; a library
  // schema has no $id.
  return {
    $schema,
    ...($id && { $id }),
    title,
    description,
    ...rest,
  };
}

// Each library's file holds the CLI's keys and the library's own.
const libraries = [
  [
    'gt-next',
    'next',
    async () =>
      (await import('../../next/dist/config-dir/schema.mjs'))
        .gtNextConfigEntries,
  ],
  ['gt-react', 'react'],
  ['gt-react-native', 'react-native'],
  ['gt-tanstack-start', 'tanstack-start'],
  ['gt-vue', 'vue'],
  ['gt-svelte', 'svelte'],
  ['gt-node', 'node'],
];

async function generateAll() {
  const { GTConfigFileSchema, GTConfigFileSchemaDefinitions } =
    await import('../dist/config/schema.js');
  const outputs = [
    [
      configJsonSchemaPath,
      generateConfigJsonSchema(
        GTConfigFileSchema,
        GTConfigFileSchemaDefinitions
      ),
    ],
  ];
  for (const [library, directory, loadEntries] of libraries) {
    const libraryEntries = loadEntries ? await loadEntries() : {};
    const schema = v.pipe(
      v.strictObject({ ...GTConfigFileSchema.entries, ...libraryEntries }),
      v.metadata({
        title: `General Translation Configuration for ${library}`,
        description: `gt.config.json for a project that uses ${library} and the gt CLI`,
      })
    );
    outputs.push([
      fileURLToPath(
        new URL(`../../${directory}/config-schema.json`, import.meta.url)
      ),
      generateConfigJsonSchema(schema, GTConfigFileSchemaDefinitions),
    ]);
  }
  return outputs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputs = await generateAll();
  if (process.argv.includes('--check')) {
    const stale = outputs.filter(
      ([path, json]) =>
        !existsSync(path) ||
        !isDeepStrictEqual(JSON.parse(readFileSync(path, 'utf8')), json)
    );
    if (stale.length) {
      console.error(
        `Out of date; run pnpm generate:config-schema:\n${stale.map(([path]) => `  ${path}`).join('\n')}`
      );
      process.exit(1);
    }
  } else {
    for (const [path, json] of outputs)
      writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  }
}
