import { execSync } from 'child_process';

export async function getPackageInfo(packageName: string): Promise<
  | {
      version: string;
    }
  | undefined
> {
  try {
    const output = execSync(`npm list -g ${packageName}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const match = output.match(new RegExp(`${packageName}@([\\d\\.\\w-]+)`));
    if (match && match[1]) {
      return { version: match[1] };
    }

    return undefined;
  } catch (error) {
    return undefined;
  }
}
