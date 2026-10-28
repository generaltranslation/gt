import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
// Inside the package root, so `gt-next/link` resolves through the exports map
// by self-reference to the built declarations.
const consumerPath = join(packageRoot, 'link-consumer.mts');
// ComponentProps only accepts a component, so this fails if the default
// import is typed as the CJS module namespace.
const consumer = `
import Link from 'gt-next/link';
import type { ComponentProps } from 'react';
export const props: ComponentProps<typeof Link> = { href: '/' };
`;

const distIt = existsSync(join(packageRoot, 'dist/link.d.ts')) ? it : it.skip;

distIt(
  'types the gt-next/link default import as the Link component for NodeNext ESM consumers',
  () => {
    const options: ts.CompilerOptions = {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
    };
    const host = ts.createCompilerHost(options);
    const { fileExists, readFile, getSourceFile } = host;
    host.fileExists = (file) => file === consumerPath || fileExists(file);
    host.readFile = (file) =>
      file === consumerPath ? consumer : readFile(file);
    host.getSourceFile = (file, languageVersion, ...rest) =>
      file === consumerPath
        ? ts.createSourceFile(file, consumer, languageVersion)
        : getSourceFile(file, languageVersion, ...rest);
    const program = ts.createProgram([consumerPath], options, host);
    const consumerFile = program.getSourceFile(consumerPath)!;

    const resolved = ts.resolveModuleName(
      'gt-next/link',
      consumerPath,
      options,
      host,
      undefined,
      undefined,
      ts.ModuleKind.ESNext
    ).resolvedModule;
    expect(resolved?.resolvedFileName).toBe(
      join(packageRoot, 'dist/link.d.mts')
    );
    expect(
      ts
        .getPreEmitDiagnostics(program, consumerFile)
        .map((diagnostic) =>
          ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
        )
    ).toEqual([]);
  },
  60_000
);
