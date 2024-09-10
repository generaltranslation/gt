import fs from 'fs';
import path from 'path';

export default function loadConfigFile(configFilePath: string): object {
    const absoluteConfigFilePath = path.resolve(configFilePath);
    if (fs.existsSync(absoluteConfigFilePath)) {
        try {
            return require(absoluteConfigFilePath);
        } catch (error) {
            console.error('Failed to load the config file:', error);
            process.exit(1);
        }
    } else {
        throw new Error(`Config file not found: ${absoluteConfigFilePath}`);
    }
}