export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  tag: string;
  message: string;
  stack?: string;
}

export interface CrashRecord {
  ts: string;
  isFatal: boolean;
  message: string;
  stack?: string;
}
