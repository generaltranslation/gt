import { Num, DateTime, Currency } from 'gt-react';

export default function AllUserVariableTypes() {
  const n = 42;
  const d = new Date();
  const a = 9.99;
  return (
    <div>
      Price: <Num>{n}</Num>, Date: <DateTime>{d}</DateTime>, Amount: <Currency currency="USD">{a}</Currency>
    </div>
  );
}
