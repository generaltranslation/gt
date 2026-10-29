// Stands in for gt-react in fixture builds. The compiler imports
// GtInternalRegisterLocaleTwin from the module's own GT import source.
export function msg(message) {
  return message;
}

export function GtInternalRegisterLocaleTwin(value) {
  (globalThis.__gtLocaleTwinRegistrations ??= []).push(value);
}
