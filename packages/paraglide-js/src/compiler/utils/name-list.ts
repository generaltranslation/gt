/**
 * Names kept as one string, `\0a\0b\0`. A large project's modules export
 * millions of functions, and every analysis thread holds the names of each
 * module: as an array or a Set, each name is a string and an entry of its own.
 */
export type NameList = string;

const SEPARATOR = '\0';

/**
 * The list of `names`, without those that hold the separator: only a quoted
 * export name can, e.g. `export { a as "a\0b" }`. Use it where leaving a name
 * out is safe.
 */
export function nameList(names: Iterable<string>): NameList {
  const kept = [...names].filter((name) => !name.includes(SEPARATOR));

  return `${SEPARATOR}${kept.map((name) => `${name}${SEPARATOR}`).join('')}`;
}

export function hasName(list: NameList, name: string): boolean {
  return (
    !name.includes(SEPARATOR) &&
    list.includes(`${SEPARATOR}${name}${SEPARATOR}`)
  );
}

export function namesIn(list: NameList): string[] {
  return list.split(SEPARATOR).slice(1, -1);
}
