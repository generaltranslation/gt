import { logger } from '../../logging/logger.js';
import dependencyTree, { Tree } from 'dependency-tree';
import * as fs from 'node:fs';
import * as path from 'node:path';

export type DagOptions = {
  tsConfig?: string;
  webpackConfig?: string;
  requireConfig?: string;
};

export type DagNode = {
  [filename: string]: DagNode;
};

export class Dag {
  private dag: DagNode;
  private reverseDag: Record<string, string[]>;
  private dependenciesMap: Record<string, string[]>;
  private topologicalOrder: string[];

  constructor(dag: DagNode) {
    this.dag = dag;
    const { reverseDag, dependenciesMap } = this.buildMaps(dag);
    this.reverseDag = reverseDag;
    this.dependenciesMap = dependenciesMap;
    this.topologicalOrder = this.buildTopologicalOrder();
  }

  private buildMaps(dag: DagNode): {
    reverseDag: Record<string, string[]>;
    dependenciesMap: Record<string, string[]>;
  } {
    const reverseDag: Record<string, string[]> = {};
    const dependenciesMap: Record<string, string[]> = {};

    // Clean the file paths recursively
    const cleanedDag = cleanFilePaths(dag);

    function traverse(node: DagNode, parent?: string): void {
      for (const [filename, subtree] of Object.entries(node)) {
        // Build dependencies map - direct dependencies are the keys of subtree
        if (!dependenciesMap[filename]) {
          dependenciesMap[filename] = Object.keys(subtree);
        }

        // Build reverse DAG - if we have a parent, parent depends on filename
        // So filename has parent as a dependent
        if (parent) {
          if (!reverseDag[filename]) {
            reverseDag[filename] = [];
          }
          reverseDag[filename].push(parent);
        }

        // Recursively traverse the subtree
        if (typeof subtree === 'object' && subtree !== null) {
          traverse(subtree, filename);
        }
      }
    }

    traverse(cleanedDag);
    return { reverseDag, dependenciesMap };
  }

  // No need to worry about cycles since the DAG is a tree
  private buildTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const dfs = (file: string) => {
      if (visited.has(file)) return;
      visited.add(file);

      const dependencies = this.dependenciesMap[file] || [];
      for (const dep of dependencies) {
        dfs(dep);
      }

      result.push(file);
    };

    // Visit all files in the DAG
    for (const file of Object.keys(this.dependenciesMap)) {
      dfs(file);
    }

    return result;
  }
  // Get all direct dependencies of a file
  getDependencies(filename: string): string[] {
    // return this.dependenciesMap[filename] || [];
    return this.reverseDag[filename] || [];
  }
  // Get all children of a file
  getDependents(filename: string): string[] {
    // return this.reverseDag[filename] || [];
    return this.dependenciesMap[filename] || [];
  }

  getDag(): DagNode {
    return this.dag;
  }

  getReverseDag(): Record<string, string[]> {
    return this.reverseDag;
  }

  getTopologicalOrder(): string[] {
    return this.topologicalOrder;
  }
}

export function createDag(directories: string[], options: DagOptions): Dag {
  const allTrees: Tree[] = [];
  const visited: dependencyTree.Tree = {};
  const nonExistent: string[] = [];

  const files = discoverSourceFiles(directories);

  logger.debugMessage(
    `Creating combined tree for ${files.length} files and ${directories.length} directories`
  );

  files.forEach((file) => {
    if (visited[file]) {
      return;
    }

    try {
      const tree = dependencyTree({
        directory: process.cwd(),
        filename: file,
        filter: (path: string) => !path.includes('node_modules'),
        visited: visited,
        nonExistent: nonExistent,
        tsConfig: options.tsConfig,
        webpackConfig: options.webpackConfig,
        requireConfig: options.requireConfig,
      });
      allTrees.push(tree);
    } catch (error) {
      logger.debugMessage(`Failed to create tree for ${file}: ${error}`);
    }
  });

  return new Dag(mergeTrees(allTrees));
}

function cleanFilePath(filePath: string): string {
  return path.relative(process.cwd(), filePath);
}

function cleanFilePaths(dag: DagNode): DagNode {
  const result: DagNode = {};

  for (const [filename, subtree] of Object.entries(dag)) {
    const cleanedFilename = cleanFilePath(filename);
    result[cleanedFilename] = cleanFilePaths(subtree);
  }

  return result;
}

function mergeTrees(trees: Tree[]): DagNode {
  const result: DagNode = {};

  function mergeTree(tree: Tree, target: DagNode): void {
    if (typeof tree === 'object' && tree !== null) {
      for (const [filename, subtree] of Object.entries(tree)) {
        if (!target[filename]) {
          target[filename] = {};
        }
        mergeTree(subtree, target[filename]);
      }
    }
  }

  // Process each tree
  trees.forEach((tree) => {
    mergeTree(tree, result);
  });

  return result;
}

function discoverSourceFiles(directories: string[]): string[] {
  const files: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];

  function walkDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and common build/cache directories
        if (
          !['node_modules', '.next', 'dist', 'build', '.git'].includes(item)
        ) {
          walkDirectory(fullPath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  for (const directory of directories) {
    walkDirectory(directory);
  }

  return files;
}
