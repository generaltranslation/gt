import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInlineUpdates } from '../createInlineUpdates.js';
import { getValidateJson } from '../../../translation/validate.js';
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

// Mock the Vue extraction planner so getValidateJson routes straight to
// the historical (primary) extractor for non-Vue packages.
vi.mock('@generaltranslation/vue-extractor/integration', () => ({
  planVueExtraction: vi.fn(() => ({ handled: false })),
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

// Imported helper: the helper file itself contains a decorated class, and
// the page calls the helper with the gt callback from useGT().
const HELPER_WITH_DECORATED_CLASS = `import { Controller } from '@nestjs/common';

@Controller()
export class HelperController {}

export function getInfo(gt: (text: string) => string) {
  return gt('Helper info');
}
`;

const PAGE_CALLING_IMPORTED_HELPER = `import { useGT } from 'gt-react';
import { getInfo } from './helper';

export function Component() {
  const gt = useGT();
  getInfo(gt);
}
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

  it('extracts strings from an imported helper whose file has a decorated class', async () => {
    // Regression test for the Greptile review on gt#2823: extraction follows
    // an imported helper (getInfo) into its own file, and that file must
    // parse even when it contains a decorated class.
    const helperPath = path.join(tmpDir, 'helper.ts');
    fs.writeFileSync(helperPath, HELPER_WITH_DECORATED_CLASS);
    const pagePath = path.join(tmpDir, 'page.tsx');
    fs.writeFileSync(pagePath, PAGE_CALLING_IMPORTED_HELPER);
    vi.mocked(matchFiles).mockReturnValue([pagePath]);

    const result = await createInlineUpdates(
      Libraries.GT_REACT,
      false,
      undefined,
      parsingFlags,
      parsingOptions
    );

    expect(result.errors).toHaveLength(0);
    expect(result.updates.map((update) => update.source)).toContain(
      'Helper info'
    );
  });

  it('keys a parse failure under the exact filepath in getValidateJson', async () => {
    // Regression test for the Pullfrog review on gt#2823: a parse failure
    // must be reported as "filepath (line:col): message" so
    // getValidateJson returns the error under the exact source filepath,
    // instead of a key like "Error parsing file <path>: SyntaxError".
    const filePath = path.join(tmpDir, 'broken.ts');
    fs.writeFileSync(filePath, 'export const x = ;\n');
    vi.mocked(matchFiles).mockReturnValue([filePath]);

    const settings = {
      files: { gtJson: { parsingFlags } },
      parsingOptions,
    } as unknown as Parameters<typeof getValidateJson>[0];

    const result = await getValidateJson(
      settings,
      Libraries.GT_REACT,
      [filePath]
    );

    expect(Object.keys(result)).toEqual([filePath]);
    expect(result[filePath][0].level).toBe('error');
  });
});
