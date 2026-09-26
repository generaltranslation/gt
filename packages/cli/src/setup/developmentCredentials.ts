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
import { OnboardingError, type OnboardingSession } from './onboarding.js';

const DEVELOPMENT_KEY_NAME = 'Development key (gt init)';

type ProjectChoice = Awaited<ReturnType<typeof api.listProjects>>[number];

/** An existing project, or the inputs for creating one. */
export type DevelopmentProject =
  | { id: string }
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

function projectCreationDeniedError(orgId: string, error: unknown): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened: `Project creation was denied for organization ${orgId}`,
    why: 'Listing an organization does not confirm permission to create projects in it',
    fix: 'Ask an organization admin for org:projects:create, or use credentials that have that permission for this organization',
    details: formatDiagnosticErrorDetails(error),
  });
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
  options: DevelopmentProjectOptions
): void {
  if (settings.projectId && options.createProject) {
    session.reject('--create-project cannot be combined with a project ID');
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
    const create = await promptConfirm({
      message: 'No projects found for your account. Create a new project?',
      defaultValue: true,
    });
    if (!create) throw new OnboardingError(noProjectChosenError);
    return resolveNewProject(session, settings, options, cwd);
  }
  const choice = await promptSelect<ProjectChoice | null>({
    message: 'Which project should this app use?',
    options: [
      ...projects.map((project) => ({
        value: project,
        label: project.name,
        hint: project.orgName,
      })),
      { value: null, label: 'Create a new project' },
    ],
  });
  return choice
    ? { id: choice.id }
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
  let projectId: string;
  if ('id' in project) {
    projectId = project.id;
  } else {
    const { orgId, name } = project.create;
    const { project: created } = await api
      .createProject(orgId, { name, defaultLocale: settings.defaultLocale })
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.code !== 403) throw error;
        throw new OnboardingError(projectCreationDeniedError(orgId, error));
      });
    logger.info(`Created ${created.name} (${created.id})`);
    session.step(`created project ${created.id}`);
    projectId = created.id;
  }
  const { apiKey } = await api.createProjectApiKey(projectId, {
    name: DEVELOPMENT_KEY_NAME,
    permissions: [ProjectApiKeyPermission['PROJECT:TRANSLATIONS:GENERATE']],
  });
  session.step('created a development key');
  await setCredentials({ projectId, apiKey: apiKey.key }, framework, cwd);
  session.step('saved development credentials to .env.local');
  logger.success(
    `Saved the project ID and a development key to ${chalk.cyan('.env.local')}.`
  );
}
