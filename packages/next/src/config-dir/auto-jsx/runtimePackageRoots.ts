import fs from 'node:fs';
import path from 'node:path';

const runtimePackages = [
  { name: 'gt-next', entry: 'gt-next' },
  { name: 'gt-react', entry: 'gt-react' },
  {
    name: '@generaltranslation/react-core',
    entry: '@generaltranslation/react-core/pure',
  },
];

function packageRoot(start: string, expected: string): string | undefined {
  let directory = path.resolve(start);
  while (true) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(manifest, 'utf8')) as {
          name?: unknown;
        };
        if (metadata.name !== undefined)
          return metadata.name === expected ? directory : undefined;
      } catch {
        return undefined;
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

/** Resolve owned runtime identities, including pnpm links and packed installs. */
export function resolveAutoJsxRuntimePackageRoots(
  configDirectory: string,
  projectDirectory?: string,
  turbopackRoot?: string
): string[] {
  const ownRoot = packageRoot(configDirectory, 'gt-next');
  if (!ownRoot) return [];
  // Keep this Node-only dependency out of rolldown's shared runtime chunk,
  // which is also imported by client-side diagnostics.
  const { createRequire } =
    require('node:module') as typeof import('node:module');
  const roots = new Set<string>();
  const visited = new Set<string>();
  const pending: string[] = [];

  const addPackage = (directory: string) => {
    const physical = fs.realpathSync(directory);
    roots.add(directory.replace(/\\/g, '/'));
    roots.add(physical.replace(/\\/g, '/'));
    if (!visited.has(physical)) {
      visited.add(physical);
      pending.push(directory);
    }
  };
  addPackage(ownRoot);
  // An app can install another runtime version alongside gt-next's copy.
  // Resolve those exact identities without excluding the app directory.
  if (projectDirectory) pending.push(projectDirectory);

  while (pending.length) {
    const directory = pending.pop()!;
    const packageRequire = createRequire(path.join(directory, 'package.json'));
    for (const { name, entry: entrySpecifier } of runtimePackages) {
      try {
        const entry = packageRequire.resolve(entrySpecifier);
        const dependency = packageRoot(path.dirname(entry), name);
        if (dependency) {
          const resolved = fs.realpathSync(dependency);
          // Node resolves links before returning the entry path. Some hosts
          // retain the logical package path in their module IDs, so keep both
          // spellings, limited to links to this exact resolved package.
          for (const base of packageRequire.resolve.paths(name) ?? []) {
            const candidate = path.join(base, name);
            if (
              fs.existsSync(candidate) &&
              fs.realpathSync(candidate) === resolved
            )
              roots.add(candidate.replace(/\\/g, '/'));
          }
          addPackage(dependency);
        }
      } catch {
        // Optional or uninstalled runtime packages cannot appear in this graph.
      }
    }
  }
  if (turbopackRoot) {
    const projectRoots = [path.resolve(turbopackRoot)];
    if (fs.existsSync(turbopackRoot))
      projectRoots.push(fs.realpathSync(turbopackRoot));
    // Turbopack gives SWC project-relative filenames. Derive aliases only from
    // the same verified package paths and the actual configured workspace root.
    for (const directory of Array.from(roots)) {
      for (const projectRoot of projectRoots) {
        const relative = path.relative(projectRoot, directory);
        if (
          relative !== '..' &&
          !relative.startsWith(`..${path.sep}`) &&
          !path.isAbsolute(relative)
        ) {
          const resourcePath = relative.replace(/\\/g, '/');
          // SWC's Filename context omits the marker included in React's debug
          // filenames. Both spellings still refer to this exact package root.
          if (resourcePath) roots.add(resourcePath);
          roots.add(`[project]${resourcePath ? `/${resourcePath}` : ''}`);
        }
      }
    }
  }
  return Array.from(roots).sort();
}
