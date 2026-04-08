import { Num } from 'gt-react';

export default function PricingTable() {
  const basic = 9;
  const pro = 29;
  const enterprise = 99;
  return (
    <div>
      <h2>Pricing Plans</h2>
      <div>
        <h3>Basic</h3>
        <p>$<Num>{basic}</Num>/month</p>
        <ul>
          <li>5 projects</li>
          <li>Basic support</li>
        </ul>
      </div>
      <div>
        <h3>Pro</h3>
        <p>$<Num>{pro}</Num>/month</p>
        <ul>
          <li>Unlimited projects</li>
          <li>Priority support</li>
        </ul>
      </div>
      <div>
        <h3>Enterprise</h3>
        <p>$<Num>{enterprise}</Num>/month</p>
        <ul>
          <li>Custom solutions</li>
          <li>Dedicated support</li>
        </ul>
      </div>
    </div>
  );
}
