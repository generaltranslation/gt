import figlet from 'figlet';
import chalk from 'chalk';

export const displayAsciiTitle = () =>
  console.log(
    '\n\n' +
      chalk.cyan(
        `  ,ad8888ba,  888888888888  
 d8"'    \`"8b      88       
d8'                88       
88                 88       
88      88888      88       
Y8,        88      88       
 Y8a.    .a88      88       
  \`"Y88888P"       88       \n\n`
      )
  );

export const displayInitializingText = () => {
  console.log(
    chalk.bold.blue('General Translation, Inc.') +
      chalk.gray('\nhttps://generaltranslation.com/docs') +
      '\n'
  );
};

export const displayProjectId = (projectId: string) => {
  console.log(chalk.yellow(`Project ID: ${chalk.bold(projectId)}`));
};

export const displayResolvedPaths = (resolvedPaths: [string, string][]) => {
  console.log(chalk.blue.bold('Resolving path aliases:'));
  console.log(
    resolvedPaths
      .map(([key, resolvedPath]) =>
        chalk.gray(`'${chalk.white(key)}' -> '${chalk.green(resolvedPath)}'`)
      )
      .join('\n')
  );
  console.log();
};

export const displayFoundTMessage = (file: string, id: string) => {
  console.log(
    `Found ${chalk.cyan('<T>')} component in ${chalk.green(
      file
    )} with id "${chalk.yellow(id)}"`
  );
};

export const displayCreatedConfigFile = (configFilepath: string) => {
  console.log(
    chalk.blue(`\nCreating config file ${chalk.green(configFilepath)}\n`)
  );
};
export const displayUpdatedConfigFile = (configFilepath: string) => {
  console.log(
    chalk.blue(`\nUpdating config file ${chalk.green(configFilepath)}\n`)
  );
};

export const displayLoadingAnimation = async (message: string) => {
  const { default: ora } = await import('ora');
  const spinner = ora({
    text: message,
    color: 'blue',
  }).start();

  return spinner;
};
