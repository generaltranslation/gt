import { Derive } from 'gt-react';

function getValue() {
  return 'dynamic';
}

export default function DeriveBasic() {
  return (
    <div>
      Hello <Derive>{getValue()}</Derive>
    </div>
  );
}
