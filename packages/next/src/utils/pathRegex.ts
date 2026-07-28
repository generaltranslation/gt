import { createInvalidPathRegexError } from '../errors/pathRegex';

export function compilePathRegex(pathRegex?: string): RegExp | undefined {
  if (pathRegex === undefined) return undefined;

  try {
    return new RegExp(pathRegex);
  } catch (error) {
    throw new Error(createInvalidPathRegexError(pathRegex, error));
  }
}

export function pathnameMatchesRegex(
  pathname: string,
  pathRegex?: RegExp
): boolean {
  return pathRegex?.test(pathname) ?? true;
}
