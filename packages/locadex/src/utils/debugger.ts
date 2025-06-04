import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

let debugLogPath: string | null = null;

function getDebugLogPath(): string {
  if (!debugLogPath) {
    const uniqueId = randomBytes(8).toString('hex');
    const debugDir = join(process.cwd(), '.tmp', uniqueId);
    
    if (!existsSync(debugDir)) {
      mkdirSync(debugDir, { recursive: true });
    }
    
    debugLogPath = join(debugDir, 'out.txt');
  }
  
  return debugLogPath;
}

export function debug(...args: any[]): void {
  const logPath = getDebugLogPath();
  const timestamp = new Date().toISOString();
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    appendFileSync(logPath, logEntry);
  } catch (error) {
    // Fallback to console if file writing fails
    console.error('Debug log write failed:', error);
    console.log(...args);
  }
}

export function getDebugLocation(): string {
  return getDebugLogPath();
}