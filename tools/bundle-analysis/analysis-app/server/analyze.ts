import { readFileSync } from 'node:fs';
import { relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { attributeBytes, loadSourceMap } from './sourcemap.ts';
import {
  createClassifier,
  UNMAPPED,
  type WorkspacePackage,
} from './workspace.ts';
import type {
  BundleKind,
  BundleReport,
  EmittedFile,
  ModuleSize,
} from '../shared/types.ts';

/**
 * Measures one bundle (client, server, or edge): the emitted JS files and the
 * bytes each original module contributes to them.
 */
export function analyzeBundle(
  kind: BundleKind,
  files: string[],
  appDir: string,
  packages: WorkspacePackage[],
  projectRoot?: string
): BundleReport {
  const classify = createClassifier(packages, appDir);
  const modules = new Map<string, ModuleSize>();
  const emitted: EmittedFile[] = [];

  const charge = (pkg: string, path: string, gt: boolean, bytes: number) => {
    const id = `${pkg}/${path}`;
    const existing = modules.get(id);
    if (existing) existing.bytes += bytes;
    else modules.set(id, { id, pkg, path, gt, bytes });
  };

  for (const file of files) {
    const buffer = readFileSync(file);
    const code = buffer.toString('utf8');
    const name = relative(appDir, file).split(sep).join('/');
    emitted.push({
      path: name,
      bytes: buffer.length,
      gzip: gzipSync(buffer, { level: 9 }).length,
    });

    const sourceMap = loadSourceMap(file, code);
    if (!sourceMap) {
      charge(UNMAPPED, name, false, buffer.length);
      continue;
    }
    for (const [source, bytes] of attributeBytes(
      code,
      sourceMap.map,
      sourceMap.dir,
      projectRoot
    )) {
      const owner = classify(source);
      charge(
        owner.pkg,
        owner.pkg === UNMAPPED ? name : owner.path,
        owner.gt,
        bytes
      );
    }
  }

  emitted.sort((a, b) => b.bytes - a.bytes);
  return {
    kind,
    files: emitted,
    totalBytes: emitted.reduce((sum, file) => sum + file.bytes, 0),
    gzipBytes: emitted.reduce((sum, file) => sum + file.gzip, 0),
    modules: [...modules.values()].sort((a, b) => b.bytes - a.bytes),
  };
}
