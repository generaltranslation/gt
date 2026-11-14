import type { ProjectHandle } from 'generaltranslation';

/** The project's default branch, whatever its name; otherwise an existing `main`, and `main` is created only when the project has neither. */
export async function getDefaultBranchId(
  project: ProjectHandle
): Promise<string> {
  const {
    items: [defaultBranch],
  } = await project.listBranches({ isDefault: 'true' });
  if (defaultBranch) return defaultBranch.id;
  const {
    items: [main],
  } = await project.listBranches({ name: ['main'] });
  if (main) return main.id;
  // Another Studio can create main after the lookup; it is reused.
  const branch = await project.createOrReuseBranch({
    name: 'main',
    isDefault: true,
  });
  return branch.id;
}
