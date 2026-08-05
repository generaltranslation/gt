import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('config framework schema', () => {
  it('accepts every Vue framework emitted by setup', () => {
    const schema = JSON.parse(
      fs.readFileSync(
        path.resolve(__dirname, '../../../../../assets/config-schema.json'),
        'utf8'
      )
    ) as {
      properties: { framework: { enum: string[] } };
    };

    expect(schema.properties.framework.enum).toEqual(
      expect.arrayContaining(['vite-vue', 'nuxt'])
    );
  });
});
