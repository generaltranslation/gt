import { t } from 'gt-react';
import { glossaryTitle } from '../shared/Glossary';
import { OrderLines } from '../shared/OrderLines';

// The Orders route opens this panel with a dynamic import.
export default function OrderDetails() {
  return (
    <aside data-test='details'>
      <h3>{t`Order details`}</h3>
      <OrderLines />
      <p>{glossaryTitle}</p>
    </aside>
  );
}
