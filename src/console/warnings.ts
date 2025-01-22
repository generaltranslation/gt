import chalk from "chalk";

export const warnApiKeyInConfig = (optionsFilepath: string) => {
  console.warn(
    chalk.yellow("WARNING: ") +
      `Found ${chalk.cyan("apiKey")} in "${chalk.green(optionsFilepath)}". ` +
      chalk.white(
        "Are you sure you want to do this? Make sure your API key is not accidentally exposed, e.g. by putting "
      ) +
      chalk.green(optionsFilepath) +
      chalk.white(" in .gitignore.\n")
  );
};

export const warnVariableProp = (
  file: string,
  attrName: string,
  value: string
) => {
  return (
    `Found ${chalk.green("<T>")} component in ${chalk.cyan(
      file
    )} with variable ${attrName}: "${chalk.white(value)}". ` +
    `Change "${attrName}" to ensure this content is translated.\n`
  );
};

export const warnNoId = (file: string) => {
  return (
    `Found ${chalk.green("<T>")} component in ${chalk.cyan(
      file
    )} with no id. ` +
    chalk.white("Add an id to ensure the content is translated.\n")
  );
};

export const warnHasUnwrappedExpression = (
  file: string,
  id: string,
  unwrappedExpressions: string[]
) => {
  return (
    `${chalk.green("<T>")} with id "${id}" in ${chalk.cyan(
      file
    )} has children: ${unwrappedExpressions.join(
      ", "
    )} that could change at runtime. ` +
    chalk.white("Use a variable component like ") +
    chalk.green("<Var>") +
    chalk.white(" (") +
    chalk.blue("https://generaltranslation.com/docs") +
    chalk.white(") to translate this properly.\n")
  );
};
