import chalk from 'chalk';

export const warnApiKeyInConfig = (optionsFilepath: string) => {
  console.warn(
    chalk.red('ERROR: ') +
      `Found ${chalk.cyan('apiKey')} in "${chalk.green(optionsFilepath)}". ` +
      chalk.white(
        'Your API key is exposed! Please remove it from the file and include it as an environment variable.'
      )
  );
};

export const warnVariableProp = (
  file: string,
  attrName: string,
  value: string
) => {
  return (
    `Found ${chalk.green('<T>')} component in ${chalk.cyan(
      file
    )} with variable ${attrName}: "${chalk.white(value)}". ` +
    `Change "${attrName}" to ensure this content is translated.\n`
  );
};

export const warnNoId = (file: string) => {
  return (
    `Found ${chalk.green('<T>')} component in ${chalk.cyan(
      file
    )} with no id. ` +
    chalk.white('Add an id to ensure the content is translated.\n')
  );
};

export const warnHasUnwrappedExpression = (
  file: string,
  id: string,
  unwrappedExpressions: string[]
) => {
  return (
    `${chalk.green('<T>')} with id "${id}" in ${chalk.cyan(
      file
    )} has children: ${unwrappedExpressions.join(
      ', '
    )} that could change at runtime. ` +
    chalk.white('Use a variable component like ') +
    chalk.green('<Var>') +
    chalk.white(' (') +
    chalk.blue('https://generaltranslation.com/docs') +
    chalk.white(') to translate this properly.\n')
  );
};

export const warnNonStaticExpression = (
  file: string,
  attrName: string,
  value: string
) => {
  return (
    `Found non-static expression in ${chalk.cyan(
      file
    )} for attribute ${attrName}: "${chalk.white(value)}". ` +
    `Change "${attrName}" to ensure this content is translated.\n`
  );
};

export const warnTemplateLiteral = (file: string, value: string) => {
  return (
    `Found template literal with quasis (${value}) in ${chalk.cyan(file)}. ` +
    chalk.white(
      'Change the template literal to a string to ensure this content is translated.\n'
    )
  );
};

export const warnTernary = (file: string) => {
  return (
    `Found ternary expression in ${chalk.cyan(file)}. ` +
    chalk.white('A Branch component may be more appropriate here.\n')
  );
};
