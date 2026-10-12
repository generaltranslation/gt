import path from 'node:path';
import chalk from 'chalk';
import { ProjectApiKeyPermission } from 'generaltranslation/api';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { ApiError } from 'generaltranslation/errors';
import { logger } from '../console/logger.js';
import { promptConfirm, promptSelect, promptText } from '../console/logging.js';
import type { Settings, SupportedFrameworks } from '../types/index.js';
import { api } from '../utils/api.js';
import { setCredentials } from '../utils/credentials.js';
import { envFiles } from '../utils/loadEnv.js';
import { createUserAuthError } from '../auth/errors.js';
import { loginInteractively } from '../auth/interactiveLogin.js';
import { OnboardingError, type OnboardingSession } from './onboarding.js';

const DEVELOPMENT_KEY_NAME = 'Development key (gt init)';

/** .env.local never reaches production; the runtime key there is set on the host. */
export function productionRuntimeKeyGuidance(dashboardUrl: string): string {
  return `${chalk.dim('For runtime translation in production, create an API key in the dashboard')} ${chalk.cyan(dashboardUrl)} ${chalk.dim('and set GT_API_KEY and GT_PROJECT_ID in your hosting environment.')}`;
}

/**
 * Interactive setup keeps the browser login with its device fallback;
 * noninteractive setup always shows a device code (and emits it as a JSON
 * event) and waits for a person to approve it, without opening a browser.
 */
export async function signInForSetup(
  session: OnboardingSession,
  baseUrl: string | undefined
): Promise<void> {
  try {
    await loginInteractively(baseUrl, session.interactive, (deviceCode) =>
      session.emit({ type: 'authorization_required', ...deviceCode })
    );
  } catch (error) {
    throw new OnboardingError(createUserAuthError('Sign in failed', error));
  }
  logger.message('You are now signed in.');
}

type ProjectChoice = Awaited<ReturnType<typeof api.listProjects>>[number];

/** An existing project, or the inputs for creating one. */
export type DevelopmentProject =
  | { id: string; name?: string }
  | { create: { orgId: string; name: string } };

export type DevelopmentProjectOptions = {
  createProject?: boolean;
  orgId?: string;
  projectName?: string;
};

function noAccessibleOrgError(dashboardUrl: string): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: 'No accessible organizations were found',
    fix: `Create an organization in the dashboard ${dashboardUrl} or ask an admin for access, then rerun the setup wizard`,
  });
}

/**
 * The API client sends GT_API_KEY instead of the sign-in whenever it is set,
 * so signing in alone cannot fix a denial; GT_API_KEY has to go first.
 */
function apiKeyDeniedGuidance(created: string, permission: string) {
  return {
    why: `GT_API_KEY is set, so setup used that key instead of your sign-in, and creating ${created} requires ${permission}`,
    fix: `Remove GT_API_KEY from your shell and from ${envFiles.join(', ')}, then rerun the setup wizard to sign in`,
    wayOut: `set GT_API_KEY to an organization key with ${permission}`,
  };
}

function projectCreationDeniedError(
  orgId: string,
  usingApiKey: boolean,
  error: unknown
): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: `Project creation was denied for organization ${orgId}`,
    ...(usingApiKey
      ? apiKeyDeniedGuidance('a project', 'org:projects:create')
      : {
          why: 'listing an organization does not confirm permission to create projects in it',
          fix: 'Ask an organization admin for org:projects:create, or use credentials that have that permission for this organization',
        }),
    details: formatDiagnosticErrorDetails(error),
  });
}

function keyCreationDeniedError(
  projectId: string,
  usingApiKey: boolean,
  error: unknown
): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: `Development key creation was denied for project ${projectId}`,
    ...(usingApiKey
      ? apiKeyDeniedGuidance('a key', 'project:api_keys:write')
      : {
          why: 'creating a key requires project:api_keys:write for this project',
          fix: 'Ask a project admin for project:api_keys:write, then rerun the setup wizard',
        }),
    details: formatDiagnosticErrorDetails(error),
  });
}

/** Replaces a 403 with setup guidance; other failures keep their own error. */
function explainForbidden(diagnostic: (error: unknown) => string) {
  return (error: unknown): never => {
    if (!(error instanceof ApiError) || error.code !== 403) throw error;
    throw new OnboardingError(diagnostic(error));
  };
}

const noProjectChosenError = createDiagnosticMessage({
  source: 'gt',
  severity: 'Error',
  whatHappened: 'No project was chosen for the development credentials',
  reassurance: 'No project files were changed',
  fix: 'Rerun with --project-id <id> or --create-project, or skip them with --no-dev-credentials',
});

async function resolveNewProject(
  session: OnboardingSession,
  settings: Settings,
  options: DevelopmentProjectOptions,
  cwd: string
): Promise<DevelopmentProject | undefined> {
  // Discovery lists accessible organizations, not creation permissions.
  // The API enforces creation permission when provisioning the project.
  const orgs = await api.listOrgs();
  if (orgs.length === 0) {
    throw new OnboardingError(noAccessibleOrgError(settings.dashboardUrl));
  }
  if (options.orgId && !orgs.some((org) => org.id === options.orgId)) {
    session.reject(
      `--org-id ${options.orgId} is not an accessible organization`
    );
  }
  const orgId = await session.answer('--org-id', {
    explicit: options.orgId,
    // One organization is not a choice between options.
    configured: orgs.length === 1 ? orgs[0].id : undefined,
    ask: () =>
      promptSelect({
        message: 'Which organization should own the new project?',
        options: orgs.map((org) => ({ value: org.id, label: org.name })),
      }),
  });
  const name = await session.answer('--project-name', {
    explicit: options.projectName?.trim() || undefined,
    ask: async () =>
      (
        await promptText({
          message: 'What should the project be called?',
          defaultValue: path.basename(cwd),
        })
      ).trim() || path.basename(cwd),
  });
  return orgId && name ? { create: { orgId, name } } : undefined;
}

/**
 * Records project inputs a noninteractive run is missing, before signing in,
 * so it never waits for approval only to fail on a missing flag.
 */
export function checkDevelopmentProjectInputs(
  session: OnboardingSession,
  settings: Settings,
  options: DevelopmentProjectOptions,
  /** Where settings.projectId came from, so a person can remove it. */
  projectIdSource: string
): void {
  if (settings.projectId && options.createProject) {
    session.reject(
      `--create-project cannot be combined with project ${settings.projectId} from ${projectIdSource}; remove --create-project to keep using it, or remove the project ID from ${projectIdSource} to create a new project`
    );
  }
  if (settings.projectId || session.interactive) return;
  if (!options.createProject) {
    session.require('--project-id or --create-project');
  } else if (!options.projectName?.trim()) {
    session.require('--project-name');
  }
}

/**
 * Chooses the project for development credentials without creating anything:
 * a supplied or configured ID, explicit creation inputs, or (interactively)
 * a selection among the account's projects.
 */
export async function resolveDevelopmentProject(
  session: OnboardingSession,
  settings: Settings,
  options: DevelopmentProjectOptions,
  cwd: string = process.cwd()
): Promise<DevelopmentProject | undefined> {
  if (settings.projectId) return { id: settings.projectId };
  if (options.createProject) {
    return resolveNewProject(session, settings, options, cwd);
  }
  const projects = await api.listProjects();
  if (projects.length === 0) {
    // Creating a project is its own choice, separate from creating a key.
    const create = await session.answer('--project-id or --create-project', {
      ask: () =>
        promptConfirm({
          message: 'No projects found for your account. Create a new project?',
          defaultValue: true,
        }),
    });
    if (create === false) throw new OnboardingError(noProjectChosenError);
    return create
      ? resolveNewProject(session, settings, options, cwd)
      : undefined;
  }
  const choice = await session.answer<ProjectChoice | null>(
    '--project-id or --create-project',
    {
      ask: () =>
        promptSelect<ProjectChoice | null>({
          message: 'Which project should this app use?',
          options: [
            ...projects.map((project) => ({
              value: project,
              label: project.name,
              hint: project.orgName,
            })),
            { value: null, label: 'Create a new project' },
          ],
        }),
    }
  );
  if (choice === undefined) return undefined;
  return choice
    ? { id: choice.id, name: choice.name }
    : resolveNewProject(session, settings, options, cwd);
}

/**
 * Creates the chosen project if needed, mints a development key limited to
 * runtime translation, and saves both to .env.local. Callers inspect
 * .env.local first; the key is never printed.
 */
export async function provisionDevelopmentCredentials(
  session: OnboardingSession,
  project: DevelopmentProject,
  settings: Settings,
  framework: SupportedFrameworks | undefined,
  cwd: string = process.cwd()
): Promise<void> {
  // Set exactly when the API client sends it in place of the sign-in.
  const usingApiKey = Boolean(settings.apiKey);
  let projectId: string;
  let projectName: string | undefined;
  if ('id' in project) {
    projectId = project.id;
    projectName = project.name;
  } else {
    const { orgId, name } = project.create;
    const { project: created } = await api
      .createProject(orgId, { name, defaultLocale: settings.defaultLocale })
      .catch(
        explainForbidden((error) =>
          projectCreationDeniedError(orgId, usingApiKey, error)
        )
      );
    logger.info(`Created ${created.name} (${created.id})`);
    session.step(`created project ${created.id}`);
    projectId = created.id;
    projectName = created.name;
  }
  const { apiKey } = await api
    .createProjectApiKey(projectId, {
      name: DEVELOPMENT_KEY_NAME,
      permissions: [ProjectApiKeyPermission['PROJECT:TRANSLATIONS:GENERATE']],
    })
    .catch(
      explainForbidden((error) =>
        keyCreationDeniedError(projectId, usingApiKey, error)
      )
    );
  session.step('created a development key');
  await setCredentials({ projectId, apiKey: apiKey.key }, framework, cwd);
  session.step('saved development credentials to .env.local');
  const projectLabel = projectName
    ? `${projectName} (${projectId})`
    : projectId;
  logger.success(
    `Created development key "${apiKey.name}" for project ${projectLabel} and saved both to ${chalk.cyan('.env.local')}.`
  );
}
