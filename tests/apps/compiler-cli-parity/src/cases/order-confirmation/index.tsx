export default function OrderConfirmation() {
  const orderId = 'ORD-2024-1234';
  const email = 'alice@example.com';
  const estimatedDays = 5;
  return (
    <div>
      <div>
        <h1>Order Confirmed!</h1>
        <p>Thank you for your purchase.</p>
      </div>
      <div>
        <h2>Order Details</h2>
        <p>Order number: <strong>{orderId}</strong></p>
        <p>
          A confirmation email has been sent to <strong>{email}</strong>.
        </p>
        <p>
          Estimated delivery: <strong>{estimatedDays} business days</strong>
        </p>
      </div>
      <div>
        <h3>What happens next?</h3>
        <ol>
          <li>We will process your order within 24 hours.</li>
          <li>You will receive a shipping notification with tracking info.</li>
          <li>Your package will arrive at your doorstep.</li>
        </ol>
      </div>
      <div>
        <a href="/orders">View Order History</a>
        <span> | </span>
        <a href="/">Return to Home</a>
      </div>
    </div>
  );
}
