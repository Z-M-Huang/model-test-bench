export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  debug(msg: string, attrs?: Record<string, unknown>): void;
  info(msg: string, attrs?: Record<string, unknown>): void;
  warn(msg: string, attrs?: Record<string, unknown>): void;
  error(msg: string, attrs?: Record<string, unknown>): void;
  child(attrs: Record<string, unknown>): ILogger;
}
