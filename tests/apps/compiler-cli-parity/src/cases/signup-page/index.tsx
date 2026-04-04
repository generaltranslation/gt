export default function SignupPage() {
  const plan = 'Pro';
  const price = 29;
  return (
    <main>
      <div>
        <h1>Create Your Account</h1>
        <p>Join thousands of users on the {plan} plan.</p>
      </div>
      <form>
        <div>
          <label>Full Name</label>
          <input type="text" placeholder="John Doe" />
        </div>
        <div>
          <label>Email Address</label>
          <input type="email" placeholder="john@example.com" />
        </div>
        <div>
          <label>Password</label>
          <input type="password" placeholder="At least 8 characters" />
        </div>
        <div>
          <p>
            Selected plan: <strong>{plan}</strong> — ${price}/month
          </p>
        </div>
        <button>Create Account</button>
        <p>
          Already have an account? <a href="/login">Log in</a>
        </p>
      </form>
      <footer>
        <p>
          By signing up, you agree to our{' '}
          <a href="/terms">Terms of Service</a> and{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>
      </footer>
    </main>
  );
}
