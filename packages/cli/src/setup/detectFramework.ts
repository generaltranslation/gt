import { FrameworkObject } from '../types/index.js';
import { isPackageInstalled } from '../utils/packageJson.js';
import { searchForPackageJson } from '../utils/packageJson.js';
import fs from 'node:fs';
import path from 'node:path';


/* ----- MAIN ----- */

/**
 * Detects the frontend framework used in the current project.
 *
 * Analyzes the project structure and dependencies to identify the framework.
 * Detection order: Mintlify → Next.js (App/Pages Router) → Gatsby → RedwoodJS → Vite → React.
 *
 * For Next.js projects, further determines whether it uses App Router or Pages Router
 * by checking for the presence of `app/` or `pages/` directories.
 *
 * @returns A promise resolving to a FrameworkObject containing:
 *   - `name`: The detected framework identifier (e.g., 'next-app', 'gatsby', 'react')
 *             or undefined if no framework is detected
 *   - `type`: The framework category (currently only 'react' for React-based frameworks)
 */
export async function detectFramework(): Promise<FrameworkObject | { name: undefined, type?: undefined }> {
  
    const packageJson = await searchForPackageJson();

    if (isMintlifyProject(packageJson)) {
        return { name: 'mintlify' };
    }

  if (!packageJson) {
    return { name: undefined };
  }

  // Check for Next.js first
  if (isPackageInstalled('next', packageJson, false, true)) {
    // Determine if it's App Router or Pages Router
    const cwd = process.cwd();
    const hasAppDir =
      fs.existsSync(path.join(cwd, 'app')) ||
      fs.existsSync(path.join(cwd, 'src', 'app'));
    const hasPagesDir =
      fs.existsSync(path.join(cwd, 'pages')) ||
      fs.existsSync(path.join(cwd, 'src', 'pages'));

    // App Router takes precedence if both exist
    if (hasAppDir) {
      return { name: 'next-app', type: 'react' };
    }
    if (hasPagesDir) {
      return { name: 'next-pages', type: 'react' };
    }
    // Default to app router for new Next.js projects
    return { name: 'next-app', type: 'react' };
  }

  // Check for Gatsby
  if (isPackageInstalled('gatsby', packageJson, false, true)) {
    return { name: 'gatsby', type: 'react' };
  }

  // Check for RedwoodJS
  if (isPackageInstalled('@redwoodjs/core', packageJson, false, true)) {
    return { name: 'redwood', type: 'react' };
  }

  // Check for Vite
  if (isPackageInstalled('vite', packageJson, false, true)) {
    return { name: 'vite', type: 'react' };
  }

  // Check for React (generic)
  if (isPackageInstalled('react', packageJson, false, true)) {
    return { name: 'react', type: 'react' };
  }

  return { name: undefined };
}

// ----- HELPER FUNCTIONS ----- //

/**
 * Detects if the current project is a Mintlify documentation project.
 *
 * Checks for the presence of docs.json (preferred) or mint.json (legacy) files.
 * For docs.json, validates that the $schema field contains "mintlify.com/docs.json".
 * Rejects projects with Next.js config files to avoid misclassification.
 *
 * @param _packageJson - The parsed package.json object (not used for Mintlify detection,
 *                       but kept for API consistency with other detection functions)
 * @returns True if the project is identified as a Mintlify project, false otherwise
 */
export function isMintlifyProject(_packageJson: Record<string, any> | null): boolean {
    const cwd = process.cwd();

    // Check for Next.js config files - if present, this is not a Mintlify project
    const nextConfigFiles = [
        'next.config.js',
        'next.config.ts',
        'next.config.mjs',
        'next.config.cjs'
    ];

    for (const configFile of nextConfigFiles) {
        if (fs.existsSync(path.join(cwd, configFile))) {
            return false;
        }
    }

    // Check for docs.json (preferred format)
    const docsJsonPath = path.join(cwd, 'docs.json');
    if (fs.existsSync(docsJsonPath)) {
        try {
            const docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf-8'));
            // Validate the $schema field contains mintlify.com/docs.json
            if (docsJson.$schema && docsJson.$schema.includes('mintlify.com/docs.json')) {
                return true;
            }
        } catch {
            return false;
        }
    }

    return false;
}