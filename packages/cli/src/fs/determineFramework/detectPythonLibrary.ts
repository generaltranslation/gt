import path from 'node:path';
import fs from 'node:fs';
import { Libraries } from '../../types/libraries.js';
import { matchPyprojectDependency } from './matchPyprojectDependency.js';
import { matchRequirementsTxtDependency } from './matchRequirementsTxtDependency.js';
import { matchSetupPyDependency } from './matchSetupPyDependency.js';

/**
 * Detect Python GT library from pyproject.toml, requirements.txt, or setup.py.
 * Checks files in priority order: pyproject.toml → requirements.txt → setup.py.
 */
export function detectPythonLibrary(
  cwd: string
): typeof Libraries.GT_FLASK | typeof Libraries.GT_FASTAPI | null {
  // Check pyproject.toml
  const pyprojectPath = path.join(cwd, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const content = fs.readFileSync(pyprojectPath, 'utf8');
    const result = matchPyprojectDependency(content);
    if (result) return result;
  }

  // Check requirements.txt
  const requirementsPath = path.join(cwd, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    const content = fs.readFileSync(requirementsPath, 'utf8');
    const result = matchRequirementsTxtDependency(content);
    if (result) return result;
  }

  // Check setup.py
  const setupPath = path.join(cwd, 'setup.py');
  if (fs.existsSync(setupPath)) {
    const content = fs.readFileSync(setupPath, 'utf8');
    const result = matchSetupPyDependency(content);
    if (result) return result;
  }

  return null;
}
