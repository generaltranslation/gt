import { Num } from 'gt-react';

export default function DashboardStats() {
  const revenue = 45231;
  const orders = 1234;
  const customers = 892;
  const conversionRate = 3.2;
  const isUp = true;
  return (
    <div>
      <h1>Dashboard</h1>
      <div>
        <div>
          <h3>Revenue</h3>
          <p>$<Num>{revenue}</Num></p>
          <span>{isUp ? "Up" : "Down"} from last month</span>
        </div>
        <div>
          <h3>Orders</h3>
          <p><Num>{orders}</Num></p>
          <span>This month</span>
        </div>
        <div>
          <h3>Customers</h3>
          <p><Num>{customers}</Num></p>
          <span>Active users</span>
        </div>
        <div>
          <h3>Conversion Rate</h3>
          <p>{conversionRate}%</p>
          <span>Average across all pages</span>
        </div>
      </div>
    </div>
  );
}
