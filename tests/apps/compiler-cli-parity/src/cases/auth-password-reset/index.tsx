export default function AuthPasswordReset() {
  const email = 'alice@example.com';
  const isSubmitted = false;

  return (
    <main>
      <h1>Reset Your Password</h1>

      {isSubmitted ? (
        <div>
          <h2>Check your email</h2>
          <p>
            We sent a password reset link to <strong>{email}</strong>.
          </p>
          <p>
            The link will expire in 24 hours. If you do not see the email,
            check your spam folder.
          </p>
          <div>
            <button>Resend email</button>
            <a href="/login">Back to login</a>
          </div>
        </div>
      ) : (
        <div>
          <p>
            Enter your email address and we will send you a link to reset
            your password.
          </p>
          <form>
            <div>
              <label>Email address</label>
              <input type="email" placeholder="you@example.com" />
            </div>
            <button type="submit">Send reset link</button>
          </form>
          <p>
            Remember your password? <a href="/login">Sign in</a>
          </p>
        </div>
      )}
    </main>
  );
}
