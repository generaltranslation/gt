import figlet from "figlet";
import chalk from "chalk";

export const displayAsciiTitle = () =>
  console.log(
    "\n" +
      chalk.cyan(
        figlet.textSync("GT", {
          font: "Univers",
        })
      )
  );

export const displayInitializingText = () => {
  console.log(
    chalk.bold.blue("General Translation, Inc.") +
      chalk.gray("\nhttps://generaltranslation.com/docs") +
      "\n"
  );
};

export const displayProjectId = (projectId: string) => {
  console.log(chalk.yellow(`Project ID: ${chalk.bold(projectId)}\n`));
};

export const displayResolvedPaths = (resolvedPaths: [string, string][]) => {
  console.log(chalk.blue.bold("Resolving path aliases:"));
  console.log(
    resolvedPaths
      .map(([key, resolvedPath]) =>
        chalk.gray(`'${chalk.white(key)}' -> '${chalk.green(resolvedPath)}'`)
      )
      .join("\n")
  );
  console.log();
};

export const displayFoundTMessage = (file: string, id: string) => {
  console.log(
    `Found ${chalk.cyan("<T>")} component in ${chalk.green(
      file
    )} with id "${chalk.yellow(id)}"`
  );
};

export const displayCreatingNewConfigFile = (configFilepath: string) => {
  console.log(
    chalk.blue(`Creating new config file as ${chalk.green(configFilepath)}\n`)
  );
};
