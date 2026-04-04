export default function SaasOnboardingWizard() {
  const currentStep = 2;
  const totalSteps = 4;
  const projectName = 'my-app';
  const framework = 'Next.js';

  return (
    <main>
      <header>
        <h1>Set up your project</h1>
        <p>Step {currentStep} of {totalSteps}</p>
      </header>

      <nav>
        <ol>
          <li>
            <span>Create project</span>
            <span>Completed</span>
          </li>
          <li>
            <span>Configure settings</span>
            <span>Current</span>
          </li>
          <li>
            <span>Connect repository</span>
            <span>Upcoming</span>
          </li>
          <li>
            <span>Deploy</span>
            <span>Upcoming</span>
          </li>
        </ol>
      </nav>

      <section>
        <h2>Configure Your Project</h2>
        <p>
          We detected <strong>{framework}</strong> as your framework.
          Adjust the settings below if needed.
        </p>

        <div>
          <div>
            <label>Project name</label>
            <input type="text" value={projectName} />
            <p>This will be used as your project URL: {projectName}.vercel.app</p>
          </div>

          <div>
            <label>Framework preset</label>
            <select>
              <option>Next.js</option>
              <option>React</option>
              <option>Vue</option>
              <option>Svelte</option>
            </select>
          </div>

          <div>
            <label>Build command</label>
            <input type="text" placeholder="npm run build" />
          </div>

          <div>
            <label>Output directory</label>
            <input type="text" placeholder=".next" />
          </div>
        </div>
      </section>

      <footer>
        <button>Back</button>
        <button>Continue</button>
      </footer>
    </main>
  );
}
