import { createDiagnosticMessage } from 'generaltranslation/internal';
import fs from 'node:fs';
import path from 'node:path';

const workspaceRootSetupError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'The setup wizard cannot run from a monorepo workspace root',
  why: 'GT must be configured in the specific app you want to localize',
  fix: "Change to that app's directory and rerun `npx gt@latest`",
});

function packageJsonDefinesWorkspaces(cwd: string): boolean {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    ) as { workspaces?: unknown };
    const workspaces = packageJson.workspaces;

    if (Array.isArray(workspaces)) {
      return workspaces.length > 0;
    }
    if (!workspaces || typeof workspaces !== 'object') {
      return false;
    }

    const packages = (workspaces as { packages?: unknown }).packages;
    return Array.isArray(packages) && packages.length > 0;
  } catch {
    return false;
  }
}

export function isWorkspaceRoot(cwd: string = process.cwd()): boolean {
  return (
    fs.existsSync(path.join(cwd, 'pnpm-workspace.yaml')) ||
    packageJsonDefinesWorkspaces(cwd)
  );
}

export function getWorkspaceRootSetupError(
  cwd: string = process.cwd()
): string | undefined {
  return isWorkspaceRoot(cwd) ? workspaceRootSetupError : undefined;
}
