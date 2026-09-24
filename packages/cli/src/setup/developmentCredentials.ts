import path from 'node:path';
import chalk from 'chalk';
import { ProjectApiKeyPermission } from 'generaltranslation/api';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { logger } from '../console/logger.js';
import {
  logErrorAndExit,
  promptSelect,
  promptText,
} from '../console/logging.js';
import type { Settings, SupportedFrameworks } from '../types/index.js';
import { api } from '../utils/api.js';
import {
  inspectCredentialsEnvFile,
  setCredentials,
} from '../utils/credentials.js';

const DEVELOPMENT_KEY_NAME = 'Development key (gt init)';

type ProjectChoice = Awaited<ReturnType<typeof api.listProjects>>[number];

function noCreatableOrgError(dashboardUrl: string): string {
  return createDiagnosticMessage({
    source: 'gt',
    severity: 'Error',
    whatHappened:
      'You are not a member of an organization that can create projects',
    fix: `Create an organization in the dashboard ${dashboardUrl} or ask an admin for access, then rerun the setup wizard`,
  });
}

async function createProject(settings: Settings, cwd: string) {
  // Organizations are only needed to create; picking an existing project
  // must work for members without create access.
  const orgs = await api.listOrgs();
  if (orgs.length === 0) {
    return logErrorAndExit(noCreatableOrgError(settings.dashboardUrl));
  }
  const orgId =
    orgs.length === 1
      ? orgs[0].id
      : await promptSelect({
          message: 'Which organization should own the new project?',
          options: orgs.map((org) => ({ value: org.id, label: org.name })),
        });
  const name = await promptText({
    message: 'What should the project be called?',
    defaultValue: path.basename(cwd),
    validate: (value) => value.trim().length > 0 || 'Enter a project name',
  });
  const { project } = await api.createProject(orgId, {
    name: name.trim() || path.basename(cwd),
    defaultLocale: settings.defaultLocale,
  });
  logger.info(`Created ${project.name} (${project.id})`);
  return project.id;
}

async function selectProject(settings: Settings, cwd: string) {
  const projects = await api.listProjects();
  if (projects.length === 0) {
    logger.info('No projects found for your account; creating one.');
    return createProject(settings, cwd);
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
  return choice ? choice.id : createProject(settings, cwd);
}

/**
 * Picks or creates the project, mints a development key limited to runtime
 * translation, and saves both to .env.local. The file is checked before any
 * key exists, every service call completes before anything is written, and
 * the key is never printed.
 */
export async function provisionDevelopmentCredentials(
  settings: Settings,
  framework: SupportedFrameworks | undefined,
  cwd: string = process.cwd()
): Promise<void> {
  await inspectCredentialsEnvFile(cwd);
  const projectId = settings.projectId || (await selectProject(settings, cwd));
  const { apiKey } = await api.createProjectApiKey(projectId, {
    name: DEVELOPMENT_KEY_NAME,
    permissions: [ProjectApiKeyPermission['PROJECT:TRANSLATIONS:GENERATE']],
  });
  await setCredentials({ projectId, apiKey: apiKey.key }, framework, cwd);
  logger.success(
    `Saved the project ID and a development key to ${chalk.cyan('.env.local')}.`
  );
}
