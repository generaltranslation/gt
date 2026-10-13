const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeValue(value: number): string {
  let vlq = value < 0 ? (-value << 1) | 1 : value << 1;
  let out = '';
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) digit |= 32;
    out += BASE64[digit];
  } while (vlq > 0);
  return out;
}

/**
 * Encodes segments given as absolute [column, source?] pairs per generated
 * line into a `mappings` string, so tests can describe maps readably.
 */
export function encodeMappings(lines: [number, number?][][]): string {
  let source = 0;
  return lines
    .map((segments) => {
      let column = 0;
      return segments
        .map(([col, src]) => {
          let out = encodeValue(col - column);
          column = col;
          if (src !== undefined) {
            out += encodeValue(src - source) + encodeValue(0) + encodeValue(0);
            source = src;
          }
          return out;
        })
        .join(',');
    })
    .join(';');
}
