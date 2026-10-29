import { msg, t, useGT, useMessages } from 'gt-react';

const raw = msg('Use {braces} literally', { $format: 'STRING' });

export default function ApiFormatString() {
  const gt = useGT();
  const m = useMessages();
  return (
    <div>
      <p>{gt('Literal {value} text', { $format: 'STRING' })}</p>
      <p>{t('Plain {curly} string', { $format: 'STRING' })}</p>
      <p>{m(raw)}</p>
    </div>
  );
}
