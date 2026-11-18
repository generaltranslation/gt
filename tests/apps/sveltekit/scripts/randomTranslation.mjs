const words = [
  'soleil',
  'nuage',
  'jardin',
  'rivière',
  'étoile',
  'montagne',
  'lumière',
  'chemin',
  'forêt',
  'horizon',
  'matin',
  'plume',
];

/** A generator seeded by text, so a hash and locale always get the same words. */
function randomFrom(seedText) {
  let state = 2166136261;
  for (const character of seedText) {
    state = Math.imul(state ^ character.codePointAt(0), 16777619) >>> 0;
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Replaces each word with a random one and keeps the surrounding spaces. */
function randomText(text, random) {
  return text.replace(
    /[^\s.,!?:;]+/g,
    () => words[Math.floor(random() * words.length)]
  );
}

/**
 * Random text with the source's shape: element ids and variable keys stay, so
 * the runtime can still place elements and values.
 */
export function randomTranslation(source, hash, locale) {
  const random = randomFrom(`${locale}:${hash}`);
  const translate = (children) => {
    if (typeof children === 'string') return randomText(children, random);
    if (Array.isArray(children)) return children.map(translate);
    if (children && typeof children === 'object') {
      if ('k' in children) return { k: children.k };
      return {
        i: children.i,
        ...(children.c !== undefined && { c: translate(children.c) }),
      };
    }
    return children;
  };
  return translate(source);
}
