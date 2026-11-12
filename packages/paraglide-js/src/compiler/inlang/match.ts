import { messageIds, type InlangProject } from './project.js';

/**
 * The project a Paraglide outdir was compiled from: the only one, else the one
 * that defines the most of `catalog` (the outdir's message ids; undefined if
 * unknown). The first of equals; none if no project defines any.
 */
export function matchInlangProject(
  projects: readonly InlangProject[],
  catalog: ReadonlySet<string> | undefined
): InlangProject | undefined {
  const isOnlyChoice = projects.length <= 1;
  if (isOnlyChoice) return projects[0];
  if (!catalog) return undefined;

  let best: InlangProject | undefined;
  let bestCount = 0;

  for (const project of projects) {
    const count = countDefined(project, catalog);
    if (count <= bestCount) continue;

    best = project;
    bestCount = count;
  }

  return best;
}

function countDefined(
  project: InlangProject,
  catalog: ReadonlySet<string>
): number {
  return [...messageIds(project)].filter((id) => catalog.has(id)).length;
}
