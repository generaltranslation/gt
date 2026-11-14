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

/** As `nameList`, but undefined if it would leave a name out. */
export function completeNameList(
  names: Iterable<string>
): NameList | undefined {
  const all = [...names];
  if (all.some((name) => name.includes(SEPARATOR))) return undefined;

  return nameList(all);
}

/** False for a name that holds the separator: no list has one. */
export function hasName(list: NameList, name: string): boolean {
  return (
    !name.includes(SEPARATOR) &&
    list.includes(`${SEPARATOR}${name}${SEPARATOR}`)
  );
}

export function namesIn(list: NameList): string[] {
  return list.split(SEPARATOR).slice(1, -1);
}

/** Where a `NameList` is in the buffer of `SharedNames`, in bytes. */
export type SharedNameList = { at: number; length: number };

/** A `NameList`, or one in the buffer of `SharedNames`. */
export type AnyNameList = NameList | SharedNameList;

/**
 * Name lists in one buffer, as UTF-8, that threads share: each reads them in
 * the same memory instead of holding a copy. A zero byte is never part of a
 * character in UTF-8, so a name is found exactly.
 */
export class SharedNames {
  constructor(private readonly bytes: Buffer) {}

  has(list: AnyNameList, name: string): boolean {
    if (typeof list === 'string') return hasName(list, name);

    return (
      !name.includes(SEPARATOR) &&
      this.slice(list).includes(`${SEPARATOR}${name}${SEPARATOR}`)
    );
  }

  names(list: AnyNameList): string[] {
    if (typeof list === 'string') return namesIn(list);

    return namesIn(this.slice(list).toString('utf8'));
  }

  private slice({ at, length }: SharedNameList): Buffer {
    return this.bytes.subarray(at, at + length);
  }
}

/** Puts `lists` in one buffer threads can share: see `SharedNames`. */
export function shareNameLists(lists: readonly NameList[]): {
  bytes: SharedArrayBuffer;
  places: SharedNameList[];
} {
  const lengths = lists.map((list) => Buffer.byteLength(list, 'utf8'));
  const bytes = new SharedArrayBuffer(
    lengths.reduce((total, length) => total + length, 0)
  );
  const view = Buffer.from(bytes);

  let at = 0;
  const places = lists.map((list, index) => {
    view.write(list, at, 'utf8');
    const place = { at, length: lengths[index]! };
    at += place.length;

    return place;
  });

  return { bytes, places };
}
