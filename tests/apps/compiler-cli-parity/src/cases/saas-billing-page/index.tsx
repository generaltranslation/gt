import { Branch, Num } from 'gt-react';

export default function SaasBillingPage() {
  const plan = { name: 'Pro', price: 49, interval: 'month' };
  const nextBillingDate = 'April 15, 2024';
  const usage = { apiCalls: 45231, limit: 100000 };
  const usagePercent = Math.round((usage.apiCalls / usage.limit) * 100);
  const paymentMethod = { type: 'card', last4: '4242', brand: 'Visa' };

  return (
    <main>
      <h1>Billing</h1>

      <section>
        <header>
          <h2>Current Plan</h2>
          <a href="/settings/plans">Change plan</a>
        </header>
        <div>
          <h3>{plan.name}</h3>
          <p>
            $<Num>{plan.price}</Num> per {plan.interval}
          </p>
          <p>
            Next billing date: <strong>{nextBillingDate}</strong>
          </p>
        </div>
      </section>

      <section>
        <h2>Usage This Period</h2>
        <div>
          <div>
            <span>API Calls</span>
            <span>
              <Num>{usage.apiCalls}</Num> / <Num>{usage.limit}</Num>
            </span>
          </div>
          <div style={{ width: `${usagePercent}%` }} />
          <p>{usagePercent}% of your monthly limit used</p>
          {usagePercent > 80 && (
            <p>
              <strong>Warning:</strong> You are approaching your usage limit.{' '}
              <a href="/settings/plans">Upgrade your plan</a> for more capacity.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2>Payment Method</h2>
        <Branch
          branch={paymentMethod.type}
          card={
            <div>
              <span>{paymentMethod.brand} ending in {paymentMethod.last4}</span>
              <button>Update card</button>
            </div>
          }
        >
          <div>
            <p>No payment method on file.</p>
            <button>Add payment method</button>
          </div>
        </Branch>
      </section>

      <section>
        <h2>Billing History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mar 15, 2024</td>
              <td>Pro plan — Monthly</td>
              <td>$49.00</td>
              <td>Paid</td>
            </tr>
            <tr>
              <td>Feb 15, 2024</td>
              <td>Pro plan — Monthly</td>
              <td>$49.00</td>
              <td>Paid</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  );
}
