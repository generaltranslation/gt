import { api } from './core';

/** The project's default branch, whatever its name; `main` is created only when the project has none. */
export async function getDefaultBranchId(): Promise<string> {
  const {
    items: [defaultBranch],
  } = await api.listBranches({ isDefault: 'true' });
  if (defaultBranch) return defaultBranch.id;
  const { branch } = await api.createBranch({ name: 'main', isDefault: true });
  return branch.id;
}
