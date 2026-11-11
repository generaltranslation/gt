import path from 'node:path';
import {
  isJsonObject,
  readJsonObject,
  type JsonObject,
} from '../utils/json.js';
import { readMessageFile, type MessageFile } from './message-file.js';

export type InlangProject = {
  /** Absolute, e.g. `/app/project.inlang`. */
  directory: string;
  /** The base locale's message files that exist. */
  messageFiles: readonly MessageFile[];
};

/** The settings key of the inlang message format plugin. */
const MESSAGE_FORMAT = 'plugin.inlang.messageFormat';
/** `{languageTag}` is the placeholder's name in Paraglide 1 projects. */
const LOCALE_PLACEHOLDER = /\{(?:locale|languageTag)\}/g;

/** Reads the base-locale messages of an inlang project; undefined if `directory` is not one. */
export async function readInlangProject(
  directory: string
): Promise<InlangProject | undefined> {
  const settings = await readJsonObject(path.join(directory, 'settings.json'));
  if (!settings) return undefined;

  const paths = messageFilePaths(settings, directory);
  const files = await Promise.all(paths.map(readMessageFile));
  const messageFiles = files.filter((file) => file !== undefined);

  return { directory, messageFiles };
}

/** `pathPattern: "./messages/{locale}.json"` → `["/app/messages/en.json"]` */
function messageFilePaths(settings: JsonObject, directory: string): string[] {
  // `sourceLanguageTag` is its name in Paraglide 1 projects.
  const baseLocale = settings.baseLocale ?? settings.sourceLanguageTag;
  if (typeof baseLocale !== 'string') return [];

  // inlang resolves a pattern from the directory that holds the project.
  const base = path.dirname(directory);
  const paths = pathPatterns(settings).map((pattern) =>
    path.resolve(base, pattern.replace(LOCALE_PLACEHOLDER, baseLocale))
  );

  return [...new Set(paths)];
}

/** The message format plugin's `pathPattern`: one pattern or a list of them. */
function pathPatterns(settings: JsonObject): string[] {
  const format = settings[MESSAGE_FORMAT];
  if (!isJsonObject(format)) return [];

  return [format.pathPattern].flat().filter(isJsonPattern);
}

function isJsonPattern(pattern: unknown): pattern is string {
  return typeof pattern === 'string' && pattern.endsWith('.json');
}
