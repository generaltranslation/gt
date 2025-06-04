import path from 'node:path';
import fs from 'node:fs';

// Add a file to the .gitignore file
export async function addToGitIgnore(
  relativeDirPath: string,
  fileName: string
) {
  const gitignoreFile = path.join(relativeDirPath, '.gitignore');
  if (fs.existsSync(gitignoreFile)) {
    const gitignoreContent = await fs.promises.readFile(gitignoreFile, 'utf8');
    if (!gitignoreContent.includes(fileName)) {
      await fs.promises.appendFile(
        gitignoreFile,
        `\n# Locadex\n${fileName}\n`,
        'utf8'
      );
    }
  } else {
    await fs.promises.writeFile(
      gitignoreFile,
      `# Locadex\n${fileName}\n`,
      'utf8'
    );
  }
}
