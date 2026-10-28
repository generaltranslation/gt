#!/usr/bin/env node

// Writes assets/config-schema.json from the built gt.config.json schema, or
// with --check exits 1 when the committed file differs. Build gt first.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { toJsonSchema } from '@valibot/to-json-schema';

export const configJsonSchemaPath = fileURLToPath(
  new URL('../../../assets/config-schema.json', import.meta.url)
);

/** Users author the input shape; unsupported actions fail instead of being dropped. */
export function generateConfigJsonSchema(schema, definitions) {
  return toJsonSchema(schema, {
    target: 'draft-07',
    typeMode: 'input',
    errorMode: 'throw',
    definitions,
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { GTConfigFileSchema, GTConfigFileSchemaDefinitions } =
    await import('../dist/config/schema.js');
  const generated = generateConfigJsonSchema(
    GTConfigFileSchema,
    GTConfigFileSchemaDefinitions
  );

  if (process.argv.includes('--check')) {
    const committed = JSON.parse(readFileSync(configJsonSchemaPath, 'utf8'));
    if (!isDeepStrictEqual(generated, committed)) {
      console.error(
        'assets/config-schema.json is out of date. Run `pnpm generate:config-schema` and commit the result.'
      );
      process.exit(1);
    }
  } else {
    // Lead with the identifying keywords, as hand-written schemas do.
    const { $schema, $id, title, description, ...rest } = generated;
    const ordered = { $schema, $id, title, description, ...rest };
    writeFileSync(
      configJsonSchemaPath,
      `${JSON.stringify(ordered, null, 2)}\n`
    );
  }
}
