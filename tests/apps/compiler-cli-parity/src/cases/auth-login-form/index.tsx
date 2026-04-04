export default function AuthLoginForm() {
  const hasError = true;
  const errorMessage = 'Invalid email or password';
  const supportEmail = 'support@acme.com';

  return (
    <main>
      <div>
        <h1>Welcome back</h1>
        <p>Sign in to your account to continue.</p>
      </div>

      {hasError && (
        <div role="alert">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      <form>
        <div>
          <label>Email address</label>
          <input type="email" placeholder="you@example.com" />
        </div>
        <div>
          <div>
            <label>Password</label>
            <a href="/forgot-password">Forgot password?</a>
          </div>
          <input type="password" placeholder="Enter your password" />
        </div>
        <div>
          <label>
            <input type="checkbox" />
            Remember me for 30 days
          </label>
        </div>
        <button type="submit">Sign in</button>
      </form>

      <div>
        <p>Or continue with</p>
        <div>
          <button>Google</button>
          <button>GitHub</button>
        </div>
      </div>

      <p>
        Do not have an account?{' '}
        <a href="/signup">Create one for free</a>
      </p>

      <footer>
        <p>
          Having trouble? Contact us at{' '}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
      </footer>
    </main>
  );
}
