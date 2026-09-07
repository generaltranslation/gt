// Multiline JSX exposes the whitespace difference between manual and auto extraction.
// prettier-ignore
export function manualFirst() {
  return <p>
    First line
    second line
  </p>;
}

// prettier-ignore
export function freshAuto() {
  return <p>
    First line
    second line
  </p>;
}
