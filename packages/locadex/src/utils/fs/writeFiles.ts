import path from 'node:path';
import fs from 'node:fs';

// Add a file to the .gitignore file
export async function addToGitIgnore(filePath: string) {
  const gitignoreFile = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignoreFile)) {
    const gitignoreContent = await fs.promises.readFile(gitignoreFile, 'utf8');
    if (!gitignoreContent.includes(filePath)) {
      await fs.promises.appendFile(
        gitignoreFile,
        `\n# Locadex\n${filePath}\n`,
        'utf8'
      );
    }
  } else {
    await fs.promises.writeFile(
      gitignoreFile,
      `# Locadex\n${filePath}\n`,
      'utf8'
    );
  }
}
