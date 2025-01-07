import fs from 'fs'
import { displayCreatingNewConfigFile } from '../console/console';

/**
 * Checks if the config file exists. If not, creates a new JSON file at the given filepath and writes the provided config object to it.
 * @param {string} configFilepath - The path to the config file.
 * @param {Record<string, any>} configObject - The config object to write if the file does not exist.
 */
export default function updateConfigFile(
    configFilepath: string,
    configObject: Record<string, any>
): void {
    try {
        // Check if the file exists
        if (!fs.existsSync(configFilepath)) {
            // Filter out empty string values from the config object
            const filteredConfigObject = Object.fromEntries(
                Object.entries(configObject).filter(([_, value]) => value !== '')
            );
            // Convert the config object to a JSON string
            const jsonContent = JSON.stringify(filteredConfigObject, null, 2);
            // Write the JSON string to the file, creating a new file if it doesn't exist
            fs.writeFileSync(configFilepath, jsonContent, 'utf-8');
            // console.log
            displayCreatingNewConfigFile(configFilepath)
        }
    } catch (error) {
        console.error(`An error occurred while updating ${configFilepath}:`, error);
    }
}