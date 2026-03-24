import type { ILogger, LogLevel } from '../interfaces/logger.js';

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_LEVEL_LABEL: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

export class JsonLogger implements ILogger {
  private readonly level: LogLevel;
  private readonly baseAttrs: Record<string, unknown>;
  private readonly writeFn: (line: string) => void;

  constructor(
    level: LogLevel = 'info',
    baseAttrs: Record<string, unknown> = {},
    writeFn?: (line: string) => void,
  ) {
    this.level = level;
    this.baseAttrs = baseAttrs;
    this.writeFn = writeFn ?? ((line: string) => process.stderr.write(line + '\n'));
  }

  debug(msg: string, attrs?: Record<string, unknown>): void {
    this.log('debug', msg, attrs);
  }

  info(msg: string, attrs?: Record<string, unknown>): void {
    this.log('info', msg, attrs);
  }

  warn(msg: string, attrs?: Record<string, unknown>): void {
    this.log('warn', msg, attrs);
  }

  error(msg: string, attrs?: Record<string, unknown>): void {
    this.log('error', msg, attrs);
  }

  child(attrs: Record<string, unknown>): ILogger {
    return new JsonLogger(this.level, { ...this.baseAttrs, ...attrs }, this.writeFn);
  }

  private log(level: LogLevel, msg: string, attrs?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.level]) {
      return;
    }

    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level: LOG_LEVEL_LABEL[level],
      msg,
      ...this.baseAttrs,
      ...attrs,
    };

    this.writeFn(JSON.stringify(entry));
  }
}
