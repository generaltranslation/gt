import { useStdout } from 'ink';

const DEFAULT_COLUMNS = 80;
const DEFAULT_ROWS = 24;

export function useTerminalSize() {
  const { stdout } = useStdout();
  return {
    columns: stdout.columns ?? process.stdout.columns ?? DEFAULT_COLUMNS,
    rows: stdout.rows ?? process.stdout.rows ?? DEFAULT_ROWS,
  };
}
