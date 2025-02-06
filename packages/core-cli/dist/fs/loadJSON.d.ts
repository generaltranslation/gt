/**
 * Loads a JSON file from a given filepath, returning null if the file is not found or the JSON doesn't parse.
 * @param {string} filepath - The path to the JSON file.
 * @returns {Record<string, any> | null} - The parsed JSON object or null if an error occurs.
 */
export default function loadJSON(filepath: string): Record<string, any> | null;
