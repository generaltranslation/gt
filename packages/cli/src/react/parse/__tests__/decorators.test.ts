import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import type {
  GTParsingFlags,
  ParsingConfigOptions,
} from '../../../types/parsing.js';
import { Libraries } from '../../../types/libraries.js';

// Mock matchFiles so createInlineUpdates reads our temp fixture files
// instead of scanning the real working directory.
vi.mock('../../../fs/matchFiles.js', () => ({
  matchFiles: vi.fn(),
}));

import { matchFiles } from '../../../fs/matchFiles.js';

const parsingOptions: ParsingConfigOptions = {
  conditionNames: ['browser', 'module', 'import', 'require', 'default'],
};

const parsingFlags = {
  autoderive: false,
  includeSourceCodeContext: false,
  enableAutoJsxInjection: false,
  legacyGtReactImportSource: false,
} as GTParsingFlags;

const CONTROLLER_WITH_CLASS_DECORATOR = `import { Controller } from '@nestjs/common';
import { msg } from 'gt-node';

export const inboxLabel = msg('Inbox');

@Controller()
export class InboxController {}
`;

const CONTROLLER_WITH_METHOD_AND_PARAM_DECORATORS = `import { Controller, Get, Param } from '@nestjs/common';
import { msg } from 'gt-node';

export const greetingLabel = msg('Hello');

@Controller('items')
export class ItemsController {
  @Get(':id')
  getItem(@Param('id') id: string) {
    return msg('Item details');
  }
}
`;

const DECORATOR_FREE_CONTROL = `import { msg } from 'gt-node';

export const inboxLabel = msg('Inbox');
`;

describe('createInlineUpdates with TypeScript decorators (gt#2474)', () => {
  let tmpDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-decorators-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function runOnFixture(filename: string, content: string) {
    const filePath = path.join(tmpDir, filename);
    fs.writeFileSync(filePath, content);
    vi.mocked(matchFiles).mockReturnValue([filePath]);
    return createInlineUpdates(
      Libraries.GT_NODE,
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );
  }

  it('extracts msg() from a file with a class decorator', async () => {
    const result = await runOnFixture(
      'controller.ts',
      CONTROLLER_WITH_CLASS_DECORATOR
    );

    expect(result.errors).toHaveLength(0);
    expect(result.updates.map((update) => update.source)).toContain('Inbox');
  });

  it('extracts msg() from a file with method and parameter decorators', async () => {
    const result = await runOnFixture(
      'items-controller.ts',
      CONTROLLER_WITH_METHOD_AND_PARAM_DECORATORS
    );

    expect(result.errors).toHaveLength(0);
    const sources = result.updates.map((update) => update.source);
    expect(sources).toContain('Hello');
    expect(sources).toContain('Item details');
  });

  it('extracts the same entry from the decorator-free control file', async () => {
    const result = await runOnFixture('control.ts', DECORATOR_FREE_CONTROL);

    expect(result.errors).toHaveLength(0);
    expect(result.updates.map((update) => update.source)).toContain('Inbox');
  });

  it('records a genuine parse failure in errors instead of silently skipping the file', async () => {
    const result = await runOnFixture('broken.ts', 'export const x = ;\n');

    expect(result.updates).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join('\n')).toContain('broken.ts');
  });
});
