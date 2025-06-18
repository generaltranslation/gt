import { getPackageInfo } from 'gtx-cli/utils/packageInfo';
import { createSpinner } from '../../logging/console.js';
import chalk from 'chalk';
import { installPackageGlobal } from 'gtx-cli/utils/installPackage';
import { logger } from '../../logging/logger.js';
import { exit } from '../shutdown.js';
import { PackageManager } from 'gtx-cli/utils/packageManager';
import { updatePackageJson } from 'gtx-cli/utils/packageJson';
import path from 'node:path';
import { LocadexManager } from '../locadexManager.js';

export async function addTranslateScript(
  manager: LocadexManager,
  packageJson: Record<string, any>,
  packageManager: PackageManager
) {
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  const translateCommand = `locadex translate`;
  let translateScript = 'translate';
  if (!packageJson.scripts?.translate) {
    packageJson.scripts.translate = translateCommand;
    translateScript = 'translate';
  } else {
    if (
      packageJson.scripts.translate &&
      packageJson.scripts.translate.includes(translateCommand)
    ) {
      translateScript = 'translate';
    } else {
      packageJson.scripts['translate:gt'] = translateCommand;
      translateScript = 'translate:gt';
    }
  }
  // prefix translate to build command
  const runTranslate = `${packageManager.runScriptCommand} ${translateScript}`;
  if (
    packageJson.scripts.build &&
    !packageJson.scripts.build.includes(runTranslate)
  ) {
    packageJson.scripts.build = `${runTranslate} && ${packageJson.scripts.build}`;
  }
  await updatePackageJson(packageJson, manager.appDirectory);
  logger.success(
    `Added ${chalk.cyan(translateScript)} script to your ${chalk.cyan(
      path.relative(
        manager.rootDirectory,
        path.resolve(manager.appDirectory, 'package.json')
      )
    )} file and build command. Run ${chalk.cyan(translateScript)} to translate your project.`
  );
}

export async function installGlobalPackage(
  packageName: string,
  version: string
) {
  const packageInfo = await getPackageInfo(packageName);
  if (!packageInfo) {
    const spinner = createSpinner();
    spinner.start(`Installing ${packageName}...`);
    try {
      await installPackageGlobal(packageName, version);
      spinner.stop(chalk.green(`Installed ${packageName}.`));
    } catch (error) {
      spinner.stop(chalk.red(`Failed to install ${packageName}.`));
      logger.error(
        `${packageName} installation failed. Please install it manually and try again.`
      );
      await exit(1);
    }
  } else {
    logger.verboseMessage(
      `${packageName} is already installed: v${packageInfo.version}`
    );
  }
}
