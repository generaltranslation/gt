import fs from 'node:fs';
import path from 'node:path';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import {
  isImportFunction,
  isRequireFunction,
} from '../constants/other/helpers';
import type {
  FileId,
  NativeResolver,
  ResolvedId,
  ResolutionCache,
  SourceId,
  WatchFile,
} from './types';

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

export function normalizeFileId(id: FileId): FileId {
  return id.replace(/[?#].*$/, '');
}

/**
 * Construct and cache a local import graph starting at the given file.
 */
export async function buildResolutionGraph(
  id: FileId,
  nativeResolver: NativeResolver,
  cache: ResolutionCache,
  watchFile?: WatchFile,
  activeFiles: Set<FileId> = new Set(),
  waitForPending = true
): Promise<void> {
  const fileId = normalizeFileId(id);
  if (!postFilterPath(fileId) || cache.completed.has(fileId)) return;

  const pending = cache.pending.get(fileId);
  if (pending) {
    if (activeFiles.has(fileId) || !waitForPending) return;
    await pending;
    return;
  }

  const buildPromise = buildResolutionGraphForFile(
    fileId,
    nativeResolver,
    cache,
    watchFile,
    new Set(activeFiles).add(fileId)
  ).finally(() => {
    cache.pending.delete(fileId);
  });
  cache.pending.set(fileId, buildPromise);
  await buildPromise;
}

// ====== HELPER FUNCTIONS ====== //

async function buildResolutionGraphForFile(
  fileId: FileId,
  nativeResolver: NativeResolver,
  cache: ResolutionCache,
  watchFile: WatchFile | undefined,
  activeFiles: Set<FileId>
): Promise<void> {
  watchFile?.(fileId);
  const sources = extractSources(fileId).filter(preFilterSource);
  const resolvedSources = await Promise.all(
    sources.map(async (source) => ({
      source,
      resolved: await nativeResolver(source, fileId),
    }))
  );
  const localResolvedSources = resolvedSources.flatMap(
    ({ source, resolved }) => {
      if (!resolved || resolved.external || !postFilterPath(resolved.id)) {
        return [];
      }
      watchFile?.(normalizeFileId(resolved.id));
      return [
        {
          source,
          resolved: {
            ...resolved,
            id: normalizeFileId(resolved.id),
          },
        },
      ];
    }
  );

  const resolutions = new Map<SourceId, ResolvedId>();
  for (const { source, resolved } of localResolvedSources) {
    resolutions.set(source, resolved);
  }
  cache.resolutions.set(fileId, resolutions);

  await Promise.all(
    localResolvedSources.map(({ resolved }) =>
      buildResolutionGraph(
        resolved.id,
        nativeResolver,
        cache,
        watchFile,
        activeFiles,
        false
      )
    )
  );
  cache.completed.add(fileId);
}

/**
 * Extract statically analyzable import-like source strings from a module.
 */
export function extractSources(id: FileId): SourceId[] {
  if (!postFilterPath(id)) return [];

  let code: string;
  try {
    code = fs.readFileSync(normalizeFileId(id), 'utf8');
  } catch {
    return [];
  }

  let ast: parser.ParseResult<t.File>;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
    });
  } catch {
    return [];
  }

  const sources: SourceId[] = [];
  traverse(ast, {
    ImportDeclaration(path) {
      sources.push(path.node.source.value);
    },
    ExportAllDeclaration(path) {
      sources.push(path.node.source.value);
    },
    ExportNamedDeclaration(path) {
      if (path.node.source) {
        sources.push(path.node.source.value);
      }
    },
    CallExpression(path) {
      if (!isImportFunction(path) && !isRequireFunction(path)) return;
      const source = path.node.arguments[0];
      if (t.isStringLiteral(source)) {
        sources.push(source.value);
      }
    },
  });

  return sources;
}

/**
 * Applies pre-resolution filtering to raw source strings.
 */
export function preFilterSource(source: SourceId): boolean {
  if (!source.startsWith('.')) return false;
  return !hasPathSegment(source, 'node_modules');
}

/**
 * Applies post-resolution filtering to resolved file paths.
 */
export function postFilterPath(source: FileId): boolean {
  const filePath = normalizeFileId(source);
  if (!filePath || filePath.includes('\0')) return false;
  if (!fs.existsSync(filePath)) return false;
  if (hasPathSegment(filePath, 'node_modules')) return false;
  if (!SUPPORTED_EXTENSIONS.has(path.extname(filePath))) return false;

  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function hasPathSegment(source: string, segment: string): boolean {
  return path.normalize(source).split(path.sep).includes(segment);
}
