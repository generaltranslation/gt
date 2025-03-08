import fs from 'fs';

export default function loadConfig(filepath: string): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as Record<
      string,
      any
    >;
  } catch (error) {
    return {};
  }
}
