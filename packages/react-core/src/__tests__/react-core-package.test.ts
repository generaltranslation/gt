import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createSourceFile,
  forEachChild,
  isCallExpression,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isStringLiteralLike,
  type Node,
  ScriptKind,
  ScriptTarget,
} from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const runtimeEntryNames = ['errors', 'index', 'internal'];
const runtimeArtifactNames = runtimeEntryNames
  .flatMap((entryName) => [
    `${entryName}.cjs.min.cjs`,
    `${entryName}.esm.min.mjs`,
  ])
  .sort();
const builtArtifacts = [...runtimeArtifactNames, 'types.d.ts'].map((artifact) =>
  join(packageRoot, 'dist', artifact)
);
const workspaceSubpathPackages = [
  '@generaltranslation/format',
  '@generaltranslation/react-core',
  'generaltranslation',
  'gt-i18n',
];

function hasBuiltArtifacts(): boolean {
  return builtArtifacts.every((artifact) => existsSync(artifact));
}

function buildPackage(): void {
  const command = process.env.npm_execpath ? process.execPath : 'pnpm';
  const args = process.env.npm_execpath
    ? [process.env.npm_execpath, 'run', 'build']
    : ['run', 'build'];

  execFileSync(command, args, {
    cwd: packageRoot,
    stdio: 'pipe',
  });
}

function node(args: string[]): void {
  execFileSync(process.execPath, args, { cwd: packageRoot, stdio: 'pipe' });
}

function getRuntimeArtifactNames(): string[] {
  return readdirSync(join(packageRoot, 'dist'))
    .filter((file) => /\.(cjs|mjs)$/.test(file))
    .sort();
}

function isWorkspaceSubpath(specifier: string): boolean {
  return workspaceSubpathPackages.some((packageName) =>
    specifier.startsWith(`${packageName}/`)
  );
}

function getModuleSpecifiers(file: string): string[] {
  const code = readFileSync(join(packageRoot, 'dist', file), 'utf8');
  const sourceFile = createSourceFile(
    file,
    code,
    ScriptTarget.Latest,
    false,
    ScriptKind.JS
  );
  const specifiers: string[] = [];

  function visit(node: Node): void {
    if (
      (isImportDeclaration(node) || isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    }

    if (
      isCallExpression(node) &&
      isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }

    forEachChild(node, visit);
  }

  visit(sourceFile);
  return specifiers;
}

describe('@generaltranslation/react-core package exports', () => {
  beforeAll(() => {
    if (hasBuiltArtifacts()) return;
    buildPackage();
  });

  it('loads named exports from built CJS entrypoints', () => {
    node([
      '-e',
      `
          const assert = require('node:assert/strict');
          const reactCore = require('@generaltranslation/react-core');
          const internal = require('@generaltranslation/react-core/internal');
          const errors = require('@generaltranslation/react-core/errors');

          assert.equal(typeof reactCore.GTProvider, 'function');
          assert.equal(typeof reactCore.T, 'function');
          assert.equal(typeof internal.renderDefaultChildren, 'function');
          assert.equal(typeof errors.createUnsupportedLocaleWarning, 'function');
        `,
    ]);
  });

  it('loads named exports from built ESM entrypoints', () => {
    node([
      '--input-type=module',
      '-e',
      `
          import assert from 'node:assert/strict';
          import { GTProvider, T } from '@generaltranslation/react-core';
          import { renderDefaultChildren } from '@generaltranslation/react-core/internal';
          import { createUnsupportedLocaleWarning } from '@generaltranslation/react-core/errors';

          assert.equal(typeof GTProvider, 'function');
          assert.equal(typeof T, 'function');
          assert.equal(typeof renderDefaultChildren, 'function');
          assert.equal(typeof createUnsupportedLocaleWarning, 'function');
        `,
    ]);
  });

  it('emits independent runtime entrypoints without shared chunks', () => {
    expect(getRuntimeArtifactNames()).toEqual(runtimeArtifactNames);
  });

  it('bundles workspace subpath imports in runtime artifacts', () => {
    const externalizedSubpaths = getRuntimeArtifactNames().flatMap((file) => {
      return getModuleSpecifiers(file)
        .filter(isWorkspaceSubpath)
        .map((specifier) => `${file}: ${specifier}`);
    });

    expect(externalizedSubpaths).toEqual([]);
  });
});
