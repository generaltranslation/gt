import path from 'node:path';
import fs from 'node:fs';
import YAML from 'yaml';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  isPackageInstalled,
  searchForPackageJson,
} from '../utils/packageJson.js';
import { asRecord, OnboardingError } from './onboarding.js';

const workspaceRootSetupError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'The setup wizard cannot run from a monorepo workspace root',
  why: 'GT must be configured in the specific app you want to localize',
  fix: "Change to that app's directory and rerun `npx gt@latest`",
});

const electronSetupError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened:
    'The automatic setup wizard is not ready for Electron applications',
  docsUrl: 'https://generaltranslation.com/docs/react',
});

/**
 * Whether workspace package patterns name packages besides the root itself.
 * A single app may list only '.' (or nothing, keeping pnpm settings there).
 */
function listsChildPackages(patterns: unknown): boolean {
  if (patterns === undefined || patterns === null) return false;
  if (!Array.isArray(patterns)) return true;
  return patterns.some(
    (pattern) =>
      typeof pattern !== 'string' || !/^(?:\.\/?|!.*)$/.test(pattern.trim())
  );
}

function isMonorepoRoot(packageJson: Record<string, unknown> | null): boolean {
  const pnpmWorkspace = path.join(process.cwd(), 'pnpm-workspace.yaml');
  if (fs.existsSync(pnpmWorkspace)) {
    let packages: unknown;
    try {
      packages = asRecord(
        YAML.parse(fs.readFileSync(pnpmWorkspace, 'utf8'))
      )?.packages;
    } catch {
      return true; // Unreadable: keep refusing, as for any workspace file.
    }
    if (listsChildPackages(packages)) return true;
  }
  const workspaces = packageJson?.workspaces;
  return listsChildPackages(
    Array.isArray(workspaces) ? workspaces : asRecord(workspaces)?.packages
  );
}

export async function exitIfUnsupportedSetupTarget(): Promise<void> {
  const packageJson = await searchForPackageJson();
  if (packageJson && isPackageInstalled('electron', packageJson, false, true)) {
    throw new OnboardingError(electronSetupError);
  }
  if (isMonorepoRoot(packageJson)) {
    throw new OnboardingError(workspaceRootSetupError);
  }
}
