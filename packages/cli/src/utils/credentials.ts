import open from 'open';
import { GT_DASHBOARD_URL } from './constants';
import { createSpinner, logErrorAndExit } from '../console';
import path from 'node:path';
import fs from 'node:fs';
// Type for credentials returned from the dashboard
type Credentials = {
  apiKey: string;
  projectId: string;
};

// Fetches project ID and API key by opening the dashboard in the browser
export async function retrieveCredentials(): Promise<Credentials> {
  // Generate a session ID
  const { sessionId } = await generateCredentialsSession();

  open(`${GT_DASHBOARD_URL}/api/cli/wizard/${sessionId}`, { wait: false }).then(
    (res) => {}
  );

  const spinner = createSpinner('dots');
  spinner.start('Waiting for response from dashboard...');

  const credentials = await new Promise<Credentials>(
    async (resolve, reject) => {
      const interval = setInterval(async () => {
        // Ping the dashboard to see if the credentials are set
        try {
          const res = await fetch(
            `${GT_DASHBOARD_URL}/api/cli/wizard/${sessionId}`
          );
          if (res.ok) {
            const data = await res.json();
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(data as Credentials);
          }
        } catch (err) {
          console.error(err);
        }
      }, 1000);
      // timeout after 1 hour
      const timeout = setTimeout(
        () => {
          spinner.stop('Timed out');
          clearInterval(interval);
          logErrorAndExit('Timed out waiting for response from dashboard');
        },
        1000 * 60 * 60
      );
    }
  );
  spinner.stop();
  return credentials;
}

export async function generateCredentialsSession(): Promise<{
  sessionId: string;
}> {
  const res = await fetch(`${GT_DASHBOARD_URL}/api/cli/wizard/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return await res.json();
}

// Checks if the credentials are set in the environment variables
export function areCredentialsSet() {
  return process.env.GT_PROJECT_ID && process.env.GT_API_KEY;
}

// Sets the credentials in .env.local file
export async function setCredentials(credentials: Credentials) {
  const envFile = path.join(process.cwd(), '.env.local');
  let envContent = '';

  // Check if .env.local exists, create it if it doesn't
  if (!fs.existsSync(envFile)) {
    // File doesn't exist, create it
    await fs.promises.writeFile(envFile, '', 'utf8');

    // Add .env.local to .gitignore if it exists
    const gitignoreFile = path.join(process.cwd(), '.gitignore');
    if (fs.existsSync(gitignoreFile)) {
      const gitignoreContent = await fs.promises.readFile(
        gitignoreFile,
        'utf8'
      );
      if (!gitignoreContent.includes('.env.local')) {
        await fs.promises.appendFile(gitignoreFile, '\n.env.local\n', 'utf8');
      }
    } else {
      // Create .gitignore file with .env.local
      await fs.promises.writeFile(gitignoreFile, '.env.local\n', 'utf8');
    }
  } else {
    // Read existing content
    envContent = await fs.promises.readFile(envFile, 'utf8');
  }

  // Always append the credentials to the file
  envContent += `\nGT_PROJECT_ID=${credentials.projectId}\n`;
  envContent += `GT_API_KEY=${credentials.apiKey}\n`;

  // Ensure we don't have excessive newlines
  envContent = envContent.replace(/\n{3,}/g, '\n\n').trim() + '\n';

  // Write the updated content back to the file
  await fs.promises.writeFile(envFile, envContent, 'utf8');
}
