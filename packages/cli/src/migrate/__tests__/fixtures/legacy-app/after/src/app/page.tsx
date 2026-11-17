import { CartSummary } from '../components/CartSummary';
import { Notifications } from '../components/Notifications';
import { AccountSettings } from '../components/AccountSettings';
import { Greeting } from '../components/Greeting';

export default function HomePage() {
  return (
    <>
      <Greeting name='Ada' email='ada@example.com' plan='pro' role='admin' />
      <CartSummary
        firstName='Ada'
        itemCount={3}
        total={129.5}
        discount={10}
        promoCode='WELCOME10'
        deliveryDate={new Date('2026-12-01')}
        status='shipped'
      />
      <Notifications
        count={4}
        commenter='Grace'
        gender='female'
        orderNumber={3}
        balance={42.5}
        lastLogin={new Date('2026-11-15T09:30:00Z')}
        storageUsage={0.72}
        trialDaysLeft={5}
        shippedAt={new Date('2026-11-16T14:05:00Z')}
      />
      <AccountSettings passwordRotationDays={90} />
    </>
  );
}
