export default function StringSeparatorWithValues() {
  const left = 'Alpha';
  const right = 'Beta';
  const status: string | undefined = 'active';
  const href = '/details';
  return (
    <div>
      <p>{left}{' · '}{right}</p>
      <p>{' / '}{right}</p>
      <p>{left}{` → `}{right}</p>
      <p><span>{' » '}</span></p>
      <p>{left}{status && <>{' • '}<em>{status}</em></>}</p>
      <small>{' ~ '}<a href={href}>{right}</a></small>
    </div>
  );
}
