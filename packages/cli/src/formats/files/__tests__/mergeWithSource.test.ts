import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockSettings } from '../../../api/__mocks__/settings.js';
import { createSourceTemplate } from '../mergeWithSource.js';

vi.mock('../../../console/logger.js');

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('createSourceTemplate', () => {
  it('does not replace a failed JSON extraction with an empty object', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-template-'));
    temporaryDirectories.push(directory);
    const inputPath = path.join(directory, 'source.json');
    fs.writeFileSync(inputPath, 'invalid JSON');

    const settings = createMockSettings({
      options: {
        jsonSchema: {
          '**/*.json': {
            include: ['$.*'],
          },
        },
      },
    });

    expect(createSourceTemplate('fr', inputPath, settings)).toBeUndefined();
  });
});
