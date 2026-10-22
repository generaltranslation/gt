import type { ProjectHandle } from 'generaltranslation';
import { ApiError } from 'generaltranslation/api';

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
  try {
    const { branch } = await project.createBranch({
      name: 'main',
      isDefault: true,
    });
    return branch.id;
  } catch (error) {
    // Another Studio can create main after the lookup; a 409 reuses it.
    if (!(error instanceof ApiError) || error.code !== 409) throw error;
    const {
      items: [created],
    } = await project.listBranches({ name: ['main'] });
    if (!created) throw error;
    return created.id;
  }
}
