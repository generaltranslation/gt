const MAX_CODE_GEN_LENGTH = 100;
export function formatCodeClamp(code: string) {
  if (code.length <= MAX_CODE_GEN_LENGTH) {
    return code;
  }
  return `${code.slice(0, MAX_CODE_GEN_LENGTH)}...`;
}
