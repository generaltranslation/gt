export default function LandingPage() {
  const users = 10000;
  return (
    <main>
      <section>
        <h1>Welcome to Our Platform</h1>
        <p>Join over {users} happy customers worldwide.</p>
        <button>Get Started</button>
      </section>
      <section>
        <h2>Features</h2>
        <div>
          <h3>Fast</h3>
          <p>Lightning fast performance for all your needs.</p>
        </div>
        <div>
          <h3>Secure</h3>
          <p>Enterprise grade security you can trust.</p>
        </div>
        <div>
          <h3>Reliable</h3>
          <p>99.9% uptime guaranteed.</p>
        </div>
      </section>
      <footer>
        <p>Ready to start? <a href="/signup">Sign up now</a></p>
      </footer>
    </main>
  );
}
