import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileToUpload } from 'generaltranslation/types';
import { UploadSourcesStep } from '../UploadSourcesStep.js';
import type { BranchData } from '../../../types/branch.js';
import {
  clearRedirectSignals,
  getRedirectSignals,
} from '../../../state/mintlifyRedirectSignals.js';

vi.mock('../../../console/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    createSpinner: () => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    }),
  },
}));

type Head = { fileId: string; versionId: string; fileName: string };

const BRANCH_ID = 'branch-1';
const branchData: BranchData = {
  currentBranch: { id: BRANCH_ID, name: 'main' },
  incomingBranch: null,
  checkedOutBranch: null,
};

const enabledSettings = {
  defaultLocale: 'en',
  options: { mintlify: { localizeRedirects: true } },
};

/** A file whose ids follow the CLI's scheme: id from path, version from content. */
const file = (fileName: string, content: string): FileToUpload => ({
  content,
  fileName,
  fileFormat: 'MDX',
  locale: 'en',
  fileId: `id:${fileName}`,
  versionId: `v:${content}`,
});
const head = (fileName: string, content: string): Head => ({
  fileId: `id:${fileName}`,
  versionId: `v:${content}`,
  fileName,
});

/**
 * In-memory stand-in for the file API: one branch head per file. Moves and
 * uploads update the heads the way the server does.
 */
function createServer(
  initialHeads: Head[],
  { failMovesTo = [] as string[] } = {}
) {
  let heads = [...initialHeads];
  return {
    queryFileData: vi.fn(
      async ({
        sourceFiles = [],
      }: {
        sourceFiles?: { fileId: string; versionId: string; branchId: string }[];
      }) => ({
        sourceFiles: sourceFiles
          .filter((f) =>
            heads.some(
              (h) => h.fileId === f.fileId && h.versionId === f.versionId
            )
          )
          .map((f) => ({
            ...f,
            fileName: heads.find((h) => h.fileId === f.fileId)!.fileName,
          })),
        translatedFiles: [],
      })
    ),
    getOrphanedFiles: vi.fn(async (_branchId: string, fileIds: string[]) => ({
      orphanedFiles: heads.filter((h) => !fileIds.includes(h.fileId)),
    })),
    processFileMoves: vi.fn(
      async (
        moves: { oldFileId: string; newFileId: string; newFileName: string }[]
      ) => {
        const results = moves.map((move) => {
          const success = !failMovesTo.includes(move.newFileName);
          if (success) {
            const old = heads.find((h) => h.fileId === move.oldFileId)!;
            heads = heads.filter((h) => h.fileId !== move.oldFileId);
            heads.push({
              fileId: move.newFileId,
              versionId: old.versionId,
              fileName: move.newFileName,
            });
          }
          return { ...move, success };
        });
        const failed = results.filter((r) => !r.success).length;
        return {
          results,
          summary: {
            total: results.length,
            succeeded: results.length - failed,
            failed,
          },
        };
      }
    ),
    uploadSourceFiles: vi.fn(
      async (files: { source: FileToUpload & { branchId: string } }[]) => {
        for (const { source } of files) {
          heads = heads.filter((h) => h.fileId !== source.fileId);
          heads.push({
            fileId: source.fileId,
            versionId: source.versionId,
            fileName: source.fileName,
          });
        }
        return {
          uploadedFiles: files.map(({ source }) => ({
            fileId: source.fileId,
            versionId: source.versionId,
            fileName: source.fileName,
            fileFormat: source.fileFormat,
            branchId: source.branchId,
          })),
        };
      }
    ),
  };
}

const runStep = async (
  server: ReturnType<typeof createServer>,
  files: FileToUpload[],
  settings: Record<string, unknown> = enabledSettings
) => {
  const step = new UploadSourcesStep(server as never, settings as never);
  return step.run({ files, branchData });
};

describe('UploadSourcesStep redirect signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRedirectSignals();
  });

  it('records a rename without edits as a move with both file names', async () => {
    const server = createServer([head('docs/get-started.mdx', 'body')]);

    await runStep(server, [file('docs/how-to-get-started.mdx', 'body')]);

    expect(getRedirectSignals()).toEqual({
      movedFiles: [
        {
          oldFileName: 'docs/get-started.mdx',
          newFileName: 'docs/how-to-get-started.mdx',
        },
      ],
      newFileNames: [],
      orphanedFileNames: [],
    });
  });

  it('records a rename with edits as a new page plus an orphan', async () => {
    const server = createServer([head('docs/get-started.mdx', 'old body')]);

    await runStep(server, [file('docs/how-to-get-started.mdx', 'new body')]);

    expect(getRedirectSignals()).toEqual({
      movedFiles: [],
      newFileNames: ['docs/how-to-get-started.mdx'],
      orphanedFileNames: ['docs/get-started.mdx'],
    });
  });

  it('records a deleted page as an orphan', async () => {
    const server = createServer([
      head('docs/kept.mdx', 'kept'),
      head('docs/removed.mdx', 'removed'),
    ]);

    await runStep(server, [file('docs/kept.mdx', 'kept')]);

    expect(getRedirectSignals()).toEqual({
      movedFiles: [],
      newFileNames: [],
      orphanedFileNames: ['docs/removed.mdx'],
    });
  });

  it('does not count edited or unchanged pages as new', async () => {
    const server = createServer([
      head('docs/edited.mdx', 'before'),
      head('docs/unchanged.mdx', 'same'),
    ]);

    await runStep(server, [
      file('docs/edited.mdx', 'after'),
      file('docs/unchanged.mdx', 'same'),
      file('docs/brand-new.mdx', 'fresh'),
    ]);

    expect(getRedirectSignals()).toEqual({
      movedFiles: [],
      newFileNames: ['docs/brand-new.mdx'],
      orphanedFileNames: [],
    });
  });

  it('treats a failed move as a new page plus an orphan', async () => {
    const server = createServer([head('docs/old.mdx', 'body')], {
      failMovesTo: ['docs/new.mdx'],
    });

    await runStep(server, [file('docs/new.mdx', 'body')]);

    expect(getRedirectSignals()).toEqual({
      movedFiles: [],
      newFileNames: ['docs/new.mdx'],
      orphanedFileNames: ['docs/old.mdx'],
    });
  });

  it('does not list moved files as orphans', async () => {
    const server = createServer([
      head('docs/a.mdx', 'a'),
      head('docs/b.mdx', 'b'),
    ]);

    await runStep(server, [file('docs/a2.mdx', 'a')]);

    const recorded = getRedirectSignals();
    expect(recorded?.movedFiles).toEqual([
      { oldFileName: 'docs/a.mdx', newFileName: 'docs/a2.mdx' },
    ]);
    expect(recorded?.orphanedFileNames).toEqual(['docs/b.mdx']);
  });

  it('records nothing for a run where nothing changed', async () => {
    const server = createServer([head('docs/a.mdx', 'a')]);

    await runStep(server, [file('docs/a.mdx', 'a')]);

    expect(getRedirectSignals()).toEqual({
      movedFiles: [],
      newFileNames: [],
      orphanedFileNames: [],
    });
  });

  it('replaces signals from an earlier run', async () => {
    await runStep(createServer([head('docs/old.mdx', 'body')]), [
      file('docs/new.mdx', 'body'),
    ]);
    await runStep(createServer([head('docs/a.mdx', 'a')]), [
      file('docs/a.mdx', 'a'),
    ]);

    expect(getRedirectSignals()?.movedFiles).toEqual([]);
  });

  it('drops signals from an earlier run when a run has no files', async () => {
    await runStep(createServer([head('docs/old.mdx', 'body')]), [
      file('docs/new.mdx', 'body'),
    ]);
    await runStep(createServer([]), []);

    expect(getRedirectSignals()).toBeNull();
  });

  it('keeps upload results unchanged', async () => {
    const server = createServer([head('docs/old.mdx', 'body')]);

    const result = await runStep(server, [
      file('docs/new.mdx', 'body'),
      file('docs/fresh.mdx', 'fresh'),
    ]);

    expect(result.map((r) => r.fileName).sort()).toEqual([
      'docs/fresh.mdx',
      'docs/new.mdx',
    ]);
  });

  describe('when redirect localization is off', () => {
    it.each([
      ['option unset', { defaultLocale: 'en' }],
      [
        'option disabled',
        {
          defaultLocale: 'en',
          options: { mintlify: { localizeRedirects: false } },
        },
      ],
    ])(
      'records nothing and makes no extra API calls (%s)',
      async (_label, settings) => {
        const server = createServer([
          head('docs/old.mdx', 'old'),
          head('docs/removed.mdx', 'removed'),
        ]);

        await runStep(
          server,
          [file('docs/new.mdx', 'new'), file('docs/renamed.mdx', 'removed')],
          settings
        );

        expect(getRedirectSignals()).toBeNull();
        expect(server.getOrphanedFiles).toHaveBeenCalledTimes(1);
        expect(server.queryFileData).toHaveBeenCalledTimes(1);
      }
    );
  });
});
