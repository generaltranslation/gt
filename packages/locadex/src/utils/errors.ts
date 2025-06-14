export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class TimeoutError extends AgentError {
  constructor(
    message: string,
    public readonly timeoutSec: number
  ) {
    super(message, 'TIMEOUT');
    this.name = 'TimeoutError';
  }
}

export class UserAbortError extends AgentError {
  constructor(message: string = 'Operation was aborted by user') {
    super(message, 'USER_ABORT');
    this.name = 'UserAbortError';
  }
}

export class AgentProcessError extends AgentError {
  constructor(
    message: string,
    public readonly exitCode?: number
  ) {
    super(message, 'PROCESS_ERROR');
    this.name = 'AgentProcessError';
  }
}

export class AgentSpawnError extends AgentError {
  constructor(
    message: string,
    public readonly originalError: Error
  ) {
    super(message, 'SPAWN_ERROR');
    this.name = 'AgentSpawnError';
  }
}
