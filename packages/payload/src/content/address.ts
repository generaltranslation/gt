// Plain text values that point somewhere rather than say something: a path,
// an email or a URL. They stay in Payload untranslated.

const PATH_PREFIXES = ['/', '#', '?', './', '../'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const WHITESPACE = /\s/;

export function isAddress(value: string): boolean {
  const text = value.trim();
  if (text === '' || WHITESPACE.test(text)) return false;
  if (PATH_PREFIXES.some((prefix) => text.startsWith(prefix))) return true;
  if (EMAIL.test(text)) return true;
  if (!URL.canParse(text)) return false;
  const url = new URL(text);
  return (
    url.host !== '' || url.protocol === 'mailto:' || url.protocol === 'tel:'
  );
}
