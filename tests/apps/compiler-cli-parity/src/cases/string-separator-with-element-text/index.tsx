export default function StringSeparatorWithElementText() {
  const back: string | undefined = '/previous';
  const canEdit = true;
  const href = '/settings';
  const entityName = 'Workspace';
  const amount = 12;
  return (
    <div>
      <p>{back && <><a href={back}>Go back</a>{' · '}</>}</p>
      <p>{canEdit && <>{'. '}<a href={href}>Edit the settings</a></>}</p>
      <p>{entityName}{' · '}<button type="button">Switch</button></p>
      <small>{' / '}<a href={href}>{amount} goal</a></small>
    </div>
  );
}
