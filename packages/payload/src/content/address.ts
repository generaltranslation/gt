// Plain text values that point somewhere rather than say something: a path,
// an email or a URL. They stay in Payload untranslated.

const PATH_PREFIXES = ['/', '#', '?', './', '../'];
const WHITESPACE = /\s/;

// One @ with text before it, and a domain with a dot inside it. Checked
// without a regular expression, which backtracks on long values.
function isEmail(text: string): boolean {
  const at = text.indexOf('@');
  if (at <= 0 || at !== text.lastIndexOf('@')) return false;
  const dot = text.lastIndexOf('.');
  return dot > at + 1 && dot < text.length - 1;
}

export function isAddress(value: string): boolean {
  const text = value.trim();
  if (text === '' || WHITESPACE.test(text)) return false;
  if (PATH_PREFIXES.some((prefix) => text.startsWith(prefix))) return true;
  if (isEmail(text)) return true;
  if (!URL.canParse(text)) return false;
  const url = new URL(text);
  return (
    url.host !== '' || url.protocol === 'mailto:' || url.protocol === 'tel:'
  );
}
