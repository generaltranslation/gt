import chalk from 'chalk';

export const logWarning = (message: string) => {
  console.warn(chalk.yellow(`Warning: ${message}`));
};

export const logError = (message: string) => {
  console.error(chalk.red(`Error: ${message}`));
};

export const logInfo = (message: string) => {
  console.log(message);
};
