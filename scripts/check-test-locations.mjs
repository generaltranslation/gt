#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEST_FILE_PATTERN = /\.test\./;
const TEST_DIRECTORY = '__tests__';

export function isMisplacedTestFile(relativePath) {
  const segments = relativePath.split(/[\\/]/);
  const fileName = segments.pop();
  return TEST_FILE_PATTERN.test(fileName) && !segments.includes(TEST_DIRECTORY);
}

export function findMisplacedTestFiles(relativePaths) {
  return relativePaths.filter(isMisplacedTestFile).sort();
}

export function listRepositoryFiles(repositoryRoot = process.cwd()) {
  // Tracked files plus untracked files that are not ignored, so new tests are
  // checked before they are committed.
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  return output.split('\0').filter(Boolean);
}

export function run(repositoryRoot = process.cwd()) {
  const files = listRepositoryFiles(repositoryRoot);
  const violations = findMisplacedTestFiles(files);
  if (violations.length > 0) {
    console.error(
      `Test file location validation failed: ${violations.length} .test. file(s) outside a ${TEST_DIRECTORY} directory:`
    );
    for (const violation of violations) console.error(`- ${violation}`);
    console.error(
      `Move each test into a ${TEST_DIRECTORY} directory next to the code it covers.`
    );
    return 1;
  }

  process.stdout.write(
    `Validated that all .test. files are inside ${TEST_DIRECTORY} directories (${files.length} files checked).\n`
  );
  return 0;
}

const executedFile = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : undefined;
if (executedFile === import.meta.url) {
  process.exitCode = run();
}
