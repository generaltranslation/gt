import { Num } from 'gt-react';

export default function CommerceCheckoutForm() {
  const total = 109.97;
  const currency = 'USD';
  const email = 'user@example.com';
  const hasAccount = true;

  return (
    <main>
      <h1>Checkout</h1>

      <div>
        <section>
          <h2>Contact Information</h2>
          {hasAccount ? (
            <p>
              Logged in as <strong>{email}</strong>.{' '}
              <a href="/logout">Log out</a>
            </p>
          ) : (
            <div>
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" />
              <p>
                Already have an account? <a href="/login">Log in</a>
              </p>
            </div>
          )}
        </section>

        <section>
          <h2>Shipping Address</h2>
          <div>
            <div>
              <label>First name</label>
              <input type="text" />
            </div>
            <div>
              <label>Last name</label>
              <input type="text" />
            </div>
          </div>
          <div>
            <label>Address</label>
            <input type="text" placeholder="Street address" />
          </div>
          <div>
            <label>City</label>
            <input type="text" />
          </div>
          <div>
            <div>
              <label>State / Province</label>
              <input type="text" />
            </div>
            <div>
              <label>Postal code</label>
              <input type="text" />
            </div>
          </div>
        </section>

        <section>
          <h2>Payment Method</h2>
          <div>
            <label>Card number</label>
            <input type="text" placeholder="1234 5678 9012 3456" />
          </div>
          <div>
            <div>
              <label>Expiry date</label>
              <input type="text" placeholder="MM/YY" />
            </div>
            <div>
              <label>CVC</label>
              <input type="text" placeholder="123" />
            </div>
          </div>
        </section>
      </div>

      <aside>
        <h2>Order Summary</h2>
        <p>
          Total: <strong>$<Num>{total}</Num> {currency}</strong>
        </p>
        <button>Place Order</button>
        <p>
          By placing this order, you agree to our{' '}
          <a href="/terms">Terms of Service</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </aside>
    </main>
  );
}
