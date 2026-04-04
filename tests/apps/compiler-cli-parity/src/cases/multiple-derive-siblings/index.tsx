import { Derive } from 'gt-react';

function getSubject() { return 'cat'; }
function getObject() { return 'mouse'; }

export default function MultipleDeriveSiblings() {
  return (
    <div>
      The <Derive>{getSubject()}</Derive> plays with the <Derive>{getObject()}</Derive>
    </div>
  );
}
