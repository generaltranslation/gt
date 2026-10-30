// Stands in for gt-react in fixture builds. Like gt-react, msg() reads its
// options (a bundler drops arguments a callee never reads), including the
// locale twin marker `$_twin`: [locale, content] in a twin.
export function msg(message, options) {
  const twin = options && options.$_twin;
  return Array.isArray(twin) ? twin[1] : message;
}
