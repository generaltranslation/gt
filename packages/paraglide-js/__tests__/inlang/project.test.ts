import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { findInlangProjects } from '../../lib/compiler/inlang/find.js';
import { matchInlangProject } from '../../lib/compiler/inlang/match.js';
import { readInlangProject } from '../../lib/compiler/inlang/project.js';
import { writeFiles } from '../helpers/files.js';

const TMP = path.join(import.meta.dirname, '.tmp');
afterAll(() => fs.rm(TMP, { recursive: true, force: true }));

/** Writes `files` under `.tmp/<name>`. Returns that directory. */
async function write(
  name: string,
  files: Record<string, unknown>
): Promise<string> {
  const root = path.join(TMP, name);
  const contents = Object.entries(files).map(
    ([file, content]) => [file, JSON.stringify(content)] as const
  );
  await writeFiles(root, Object.fromEntries(contents));
  return root;
}

const messageFormat = (pathPattern: unknown) => ({
  'plugin.inlang.messageFormat': { pathPattern },
});

test('the base locale file of a path pattern, relative to the directory holding the project', async () => {
  const root = await write('single', {
    'project.inlang/settings.json': {
      baseLocale: 'en',
      locales: ['en', 'de'],
      ...messageFormat('./messages/{locale}.json'),
    },
    'messages/en.json': {
      $schema: 'https://inlang.com/schema/inlang-message-format',
      greeting: 'Hi {name}',
      nav: { home: 'Home', deep: { title: 'Title' } },
      'flat.key': 'Flat',
      plural: [{ declarations: [], selectors: [], match: {} }],
      notAMessage: 3,
    },
    'messages/de.json': { greeting: 'Hallo {name}' },
  });
  const project = await readInlangProject(path.join(root, 'project.inlang'));
  expect(project?.messageFiles).toEqual([
    {
      path: path.join(root, 'messages/en.json'),
      keys: [
        { id: '$schema', path: ['$schema'] },
        { id: 'greeting', path: ['greeting'] },
        { id: 'nav.home', path: ['nav', 'home'] },
        { id: 'nav.deep.title', path: ['nav', 'deep', 'title'] },
        { id: 'flat.key', path: ['flat.key'] },
        { id: 'plural', path: ['plural'] },
      ],
    },
  ]);
});

test('several path patterns give several message files; missing ones are skipped', async () => {
  const root = await write('several', {
    'app.inlang/settings.json': {
      baseLocale: 'fr',
      ...messageFormat([
        './messages/{locale}/common.json',
        './messages/{locale}/auth.json',
        './messages/{locale}/missing.json',
      ]),
    },
    'messages/fr/common.json': { greeting: 'Salut' },
    'messages/fr/auth.json': { login: 'Connexion' },
  });
  const project = await readInlangProject(path.join(root, 'app.inlang'));
  expect(project?.messageFiles.map((file) => file.path)).toEqual([
    path.join(root, 'messages/fr/common.json'),
    path.join(root, 'messages/fr/auth.json'),
  ]);
});

test("Paraglide 1's names: sourceLanguageTag and {languageTag}", async () => {
  const root = await write('paraglide-1', {
    'project.inlang/settings.json': {
      sourceLanguageTag: 'en',
      languageTags: ['en', 'de'],
      ...messageFormat('./messages/{languageTag}.json'),
    },
    'messages/en.json': { greeting: 'Hi' },
  });
  const project = await readInlangProject(path.join(root, 'project.inlang'));
  expect(project?.messageFiles.map((file) => file.path)).toEqual([
    path.join(root, 'messages/en.json'),
  ]);
});

test('a directory without settings is not a project; another format has no message files', async () => {
  const root = await write('other', {
    'i18next.inlang/settings.json': {
      baseLocale: 'en',
      'plugin.inlang.i18next': { pathPattern: './locales/{locale}.json' },
    },
    'empty.inlang/readme.json': {},
  });
  expect(await readInlangProject(path.join(root, 'empty.inlang'))).toBe(
    undefined
  );
  expect(
    await readInlangProject(path.join(root, 'i18next.inlang'))
  ).toMatchObject({ messageFiles: [] });
});

test('findInlangProjects: *.inlang directories directly inside, in the order searched', async () => {
  const root = await write('find', {
    'apps/web/project.inlang/settings.json': {},
    'apps/web/src/nested.inlang/settings.json': {},
    'b.inlang/settings.json': {},
    'a.inlang/settings.json': {},
    'file.inlang': {},
  });
  const web = path.join(root, 'apps/web');
  expect(
    await findInlangProjects([web, path.join(root, 'apps'), root])
  ).toEqual([
    path.join(web, 'project.inlang'),
    path.join(root, 'a.inlang'),
    path.join(root, 'b.inlang'),
  ]);
});

test('matchInlangProject: the only project, else the one defining most of the catalog', () => {
  const project = (directory: string, ids: string[]) => ({
    directory,
    messageFiles: [
      {
        path: `${directory}.json`,
        keys: ids.map((id) => ({ id, path: [id] })),
      },
    ],
  });
  const app = project('/app.inlang', ['greeting', 'login']);
  const admin = project('/admin.inlang', ['greeting', 'save', 'remove']);
  const catalog = (...ids: string[]) => new Set(ids);

  expect(matchInlangProject([], catalog('greeting'))).toBe(undefined);
  expect(matchInlangProject([app], catalog('other'))).toBe(app);
  expect(matchInlangProject([app], undefined)).toBe(app);
  expect(matchInlangProject([app, admin], catalog('greeting', 'save'))).toBe(
    admin
  );
  expect(matchInlangProject([admin, app], catalog('greeting', 'login'))).toBe(
    app
  );
  // Equals: the first, which is the nearest.
  expect(matchInlangProject([app, admin], catalog('greeting'))).toBe(app);
  expect(matchInlangProject([app, admin], catalog('other'))).toBe(undefined);
  expect(matchInlangProject([app, admin], undefined)).toBe(undefined);
});
