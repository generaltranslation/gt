/**
 * Extracts the original interpolated message string.
 * If the message cannot be decoded (i.e., it does not contain a colon separator),
 * the input is returned as-is.
 * @param encodedMsg The message to decode.
 * @returns The decoded message, or the input if it cannot be decoded.
 */
export function decodeMsg(encodedMsg: string): string;
export function decodeMsg<T extends null | undefined>(encodedMsg: T): T;
export function decodeMsg<T extends string | null | undefined>(
  encodedMsg: T
): T extends string ? string : T;
export function decodeMsg<T extends string | null | undefined>(
  encodedMsg: T
): string | T {
  if (typeof encodedMsg === 'string' && encodedMsg.lastIndexOf(':') !== -1) {
    return encodedMsg.slice(0, encodedMsg.lastIndexOf(':'));
  }
  return encodedMsg;
}
