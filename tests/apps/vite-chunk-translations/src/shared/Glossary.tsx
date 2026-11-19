import { t } from 'gt-react';

// Three routes import this module, so it gets a chunk of its own, with
// enough messages for a translations file of its own. One of them it reads
// as it is evaluated, which is when the first of those routes is imported.
((window.__evaluated ??= {}).glossary ??= []).push(performance.now());

export const glossaryTitle = t`Glossary of terms`;

export function Glossary() {
  return (
    <ul data-test='glossary'>
      <li>{t`Invoice`}</li>
      <li>{t`Receipt`}</li>
      <li>{t`Refund`}</li>
      <li>{t`Shipment`}</li>
      <li>{t`Warehouse`}</li>
      <li>{t`Carrier`}</li>
      <li>{t`Tracking number`}</li>
      <li>{t`Delivery window`}</li>
      <li>{t`Billing address`}</li>
      <li>{t`Shipping address`}</li>
      <li>{t`Payment method`}</li>
      <li>{t`Discount code`}</li>
      <li>{t`Subtotal`}</li>
      <li>{t`Sales tax`}</li>
      <li>{t`Order total`}</li>
      <li>{t`Backorder`}</li>
      <li>{t`Return label`}</li>
      <li>{t`Gift message`}</li>
      <li>{t`Packing slip`}</li>
      <li>{t`Customs form`}</li>
      <li>{t`Restocking fee`}</li>
      <li>{t`Store credit`}</li>
    </ul>
  );
}
