import fs from 'node:fs';
import path from 'node:path';
import type { ILogger, LogLevel } from '../interfaces/logger.js';
import { rotateIfNeeded, DEFAULT_ROTATION } from './log-rotator.js';

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
  private readonly logFilePath: string | undefined;

  constructor(
    level: LogLevel = 'info',
    baseAttrs: Record<string, unknown> = {},
    writeFn?: (line: string) => void,
    logFilePath?: string,
  ) {
    this.level = level;
    this.baseAttrs = baseAttrs;
    this.writeFn = writeFn ?? ((line: string) => process.stderr.write(line + '\n'));
    this.logFilePath = logFilePath;

    if (logFilePath) {
      fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    }
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
    return new JsonLogger(this.level, { ...this.baseAttrs, ...attrs }, this.writeFn, this.logFilePath);
  }

  private log(level: LogLevel, msg: string, attrs?: Record<string, unknown>): void {
    if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[this.level]) {
      return;
    }

    const entry: Record<string, unknown> = {
      ...this.baseAttrs,
      ...attrs,
      time: new Date().toISOString(),
      level: LOG_LEVEL_LABEL[level],
      msg,
    };

    const line = JSON.stringify(entry);
    this.writeFn(line);

    if (this.logFilePath) {
      try {
        fs.appendFileSync(this.logFilePath, line + '\n');
        rotateIfNeeded(this.logFilePath, DEFAULT_ROTATION);
      } catch {
        // Best-effort file logging — do not crash the process.
      }
    }
  }
}
