/**
 * Checks if the config file exists. If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * If it does exist, add the version id
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default function updateConfigFile(configFilepath: string, configObject: Record<string, any>): void;
