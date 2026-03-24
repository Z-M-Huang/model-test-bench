import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonLogger } from './logger.js';

describe('JsonLogger', () => {
  let lines: string[];
  let writeFn: (line: string) => void;

  beforeEach(() => {
    lines = [];
    writeFn = (line: string) => {
      lines.push(line);
    };
  });

  function lastEntry(): Record<string, unknown> {
    return JSON.parse(lines[lines.length - 1]);
  }

  // ─── Basic logging ───────────────────────────────────────────────

  it('logs info messages as JSON to the write function', () => {
    const logger = new JsonLogger('info', {}, writeFn);
    logger.info('hello');

    expect(lines).toHaveLength(1);
    const entry = lastEntry();
    expect(entry.level).toBe('INFO');
    expect(entry.msg).toBe('hello');
    expect(typeof entry.time).toBe('string');
  });

  it('logs debug messages when level is debug', () => {
    const logger = new JsonLogger('debug', {}, writeFn);
    logger.debug('trace data');

    expect(lines).toHaveLength(1);
    const entry = lastEntry();
    expect(entry.level).toBe('DEBUG');
    expect(entry.msg).toBe('trace data');
  });

  it('logs warn messages', () => {
    const logger = new JsonLogger('info', {}, writeFn);
    logger.warn('careful');

    expect(lines).toHaveLength(1);
    expect(lastEntry().level).toBe('WARN');
  });

  it('logs error messages', () => {
    const logger = new JsonLogger('info', {}, writeFn);
    logger.error('boom');

    expect(lines).toHaveLength(1);
    expect(lastEntry().level).toBe('ERROR');
  });

  // ─── Level filtering ────────────────────────────────────────────

  it('filters out debug when level is info', () => {
    const logger = new JsonLogger('info', {}, writeFn);
    logger.debug('should not appear');

    expect(lines).toHaveLength(0);
  });

  it('filters out debug and info when level is warn', () => {
    const logger = new JsonLogger('warn', {}, writeFn);
    logger.debug('no');
    logger.info('no');
    logger.warn('yes');
    logger.error('yes');

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).level).toBe('WARN');
    expect(JSON.parse(lines[1]).level).toBe('ERROR');
  });

  it('filters out everything below error when level is error', () => {
    const logger = new JsonLogger('error', {}, writeFn);
    logger.debug('no');
    logger.info('no');
    logger.warn('no');
    logger.error('yes');

    expect(lines).toHaveLength(1);
    expect(lastEntry().level).toBe('ERROR');
  });

  // ─── Attributes ─────────────────────────────────────────────────

  it('includes per-call attributes in log entries', () => {
    const logger = new JsonLogger('info', {}, writeFn);
    logger.info('request', { method: 'GET', path: '/api/health' });

    const entry = lastEntry();
    expect(entry.method).toBe('GET');
    expect(entry.path).toBe('/api/health');
  });

  // ─── Child logger ──────────────────────────────────────────────

  it('child logger includes parent attrs plus its own', () => {
    const logger = new JsonLogger('info', { service: 'api' }, writeFn);
    const child = logger.child({ requestId: 'abc-123' });
    child.info('handling request');

    const entry = lastEntry();
    expect(entry.service).toBe('api');
    expect(entry.requestId).toBe('abc-123');
    expect(entry.msg).toBe('handling request');
  });

  it('child logger does not mutate parent logger attrs', () => {
    const logger = new JsonLogger('info', { service: 'api' }, writeFn);
    logger.child({ requestId: 'abc-123' });
    logger.info('parent log');

    const entry = lastEntry();
    expect(entry.service).toBe('api');
    expect(entry.requestId).toBeUndefined();
  });

  it('child logger respects parent log level', () => {
    const logger = new JsonLogger('warn', {}, writeFn);
    const child = logger.child({ component: 'db' });
    child.info('should not appear');
    child.warn('should appear');

    expect(lines).toHaveLength(1);
    expect(lastEntry().level).toBe('WARN');
  });

  it('per-call attrs override base attrs', () => {
    const logger = new JsonLogger('info', { env: 'prod' }, writeFn);
    logger.info('test', { env: 'staging' });

    const entry = lastEntry();
    expect(entry.env).toBe('staging');
  });

  // ─── Time format ────────────────────────────────────────────────

  it('includes ISO 8601 time in log entries', () => {
    const logger = new JsonLogger('info', {}, writeFn);
    logger.info('time test');

    const entry = lastEntry();
    const time = entry.time as string;
    expect(new Date(time).toISOString()).toBe(time);
  });

  // ─── JSON format ────────────────────────────────────────────────

  it('outputs valid JSON for each log line', () => {
    const logger = new JsonLogger('debug', {}, writeFn);
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  // ─── Default write function ─────────────────────────────────────

  it('defaults to writing to stderr', () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const logger = new JsonLogger('info');
    logger.info('stderr test');

    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const written = stderrSpy.mock.calls[0][0] as string;
    expect(written).toContain('"msg":"stderr test"');
    expect(written).toMatch(/\n$/);

    stderrSpy.mockRestore();
  });

  // ─── Constructor defaults ───────────────────────────────────────

  it('defaults to info level when no level specified', () => {
    const logger = new JsonLogger(undefined, {}, writeFn);
    logger.debug('no');
    logger.info('yes');

    expect(lines).toHaveLength(1);
    expect(lastEntry().msg).toBe('yes');
  });
});
