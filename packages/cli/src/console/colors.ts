import chalk from 'chalk';

export function colorizeFilepath(filepath: string) {
  return chalk.cyan(filepath);
}

export function colorizeComponent(component: string) {
  return chalk.yellow(component);
}

export function colorizeIdString(id: string) {
  return chalk.yellow(id);
}
export function colorizeContent(content: string) {
  return chalk.yellow(content);
}

export function colorizeLine(line: string) {
  return chalk.dim(line);
}
