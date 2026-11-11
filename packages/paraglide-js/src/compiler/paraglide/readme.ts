import fsp from 'node:fs/promises';
import path from 'node:path';

/** "Compiled from: `/app/project.inlang`" */
const COMPILED_FROM = /^Compiled from: `(.+)`$/m;

/**
 * The inlang project an outdir's README says it was compiled from, absolute.
 * Undefined if there is no README (Paraglide 1, `emitReadme: false`) or it
 * names no project.
 */
export async function readCompiledFrom(
  outdir: string
): Promise<string | undefined> {
  const readme = await fsp
    .readFile(path.join(outdir, 'README.md'), 'utf8')
    .catch(() => undefined);
  const project = readme?.match(COMPILED_FROM)?.[1];
  if (!project || !path.isAbsolute(project)) return undefined;

  return path.normalize(project);
}
