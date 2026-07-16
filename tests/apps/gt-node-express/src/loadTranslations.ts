import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default async function loadTranslations(locale: string) {
  try {
    const filePath = path.join(process.cwd(), 'translations', `${locale}.json`);
    const data = await readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}
