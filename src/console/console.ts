import figlet from "figlet";

export const displayAsciiTitle = () =>
  console.log(
    "\n" +
      figlet.textSync("GT", {
        font: "Univers",
      })
  );

export const displayInitializingText = () => {
  console.log(
    `General Translation, Inc.` + `\nhttps://generaltranslation.com/docs` + `\n`
  );
};

export const displayProjectId = (projectId: string) => {
  console.log(`Project ID: ${projectId}\n`);
};

export const displayResolvedPaths = (resolvedPaths: [string, string][]) => {
  console.log("Resolving path aliases:");
  console.log(
    resolvedPaths
      .map(([key, resolvedPath]) => `'${key}' -> '${resolvedPath}'`)
      .join("\n")
  );
  console.log();
};

export const displayFoundTMessage = (file: string, id: string) => {
  console.log(`Found <T> component in ${file} with id "${id}"`);
};

export const displayCreatingNewConfigFile = (configFilepath: string) => {
  console.log(`Creating new config file as ${configFilepath}\n`);
};
