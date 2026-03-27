import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter, Readable } from 'node:stream';
import type { ClientRequest } from 'node:http';

// ── isNewer ──────────────────────────────────────────────────────────

import { isNewer } from './update-checker.js';

describe('isNewer', () => {
  it('returns true when major is higher', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(true);
  });

  it('returns true when minor is higher', () => {
    expect(isNewer('1.1.0', '1.0.0')).toBe(true);
  });

  it('returns true when patch is higher', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when current is newer (major)', () => {
    expect(isNewer('1.0.0', '2.0.0')).toBe(false);
  });

  it('returns false when current is newer (minor)', () => {
    expect(isNewer('1.0.0', '1.1.0')).toBe(false);
  });

  it('returns false when current is newer (patch)', () => {
    expect(isNewer('1.0.0', '1.0.1')).toBe(false);
  });

  it('handles multi-digit versions', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.9.0', '1.10.0')).toBe(false);
  });
});

// ── checkForUpdate ───────────────────────────────────────────────────

function fakeReq(): ClientRequest {
  const req = new EventEmitter() as ClientRequest;
  req.setTimeout = (() => req) as ClientRequest['setTimeout'];
  req.destroy = (() => req) as ClientRequest['destroy'];
  return req;
}

type GetCallback = (res: Readable & { statusCode: number }) => void;
type GetImpl = (url: string, opts: unknown, cb: GetCallback) => ClientRequest;

let getMock: GetImpl;

vi.mock('node:https', () => ({
  default: {
    get: (...args: unknown[]) => getMock(args[0] as string, args[1], args[2] as GetCallback),
  },
}));

// Re-import after mock is set up (Vitest hoists vi.mock above imports)
const { checkForUpdate } = await import('./update-checker.js');

describe('checkForUpdate', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints update notice when newer version exists', async () => {
    getMock = (_url, _opts, cb) => {
      const res = new Readable({ read() {} }) as Readable & { statusCode: number };
      res.statusCode = 200;
      cb(res);
      res.push(JSON.stringify({ version: '2.0.0' }));
      res.push(null);
      return fakeReq();
    };

    checkForUpdate('1.0.0');
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).toHaveBeenCalledOnce();
    const msg = consoleSpy.mock.calls[0][0] as string;
    expect(msg).toContain('Update available');
    expect(msg).toContain('1.0.0');
    expect(msg).toContain('2.0.0');
  });

  it('does not print when current version matches latest', async () => {
    getMock = (_url, _opts, cb) => {
      const res = new Readable({ read() {} }) as Readable & { statusCode: number };
      res.statusCode = 200;
      cb(res);
      res.push(JSON.stringify({ version: '1.0.0' }));
      res.push(null);
      return fakeReq();
    };

    checkForUpdate('1.0.0');
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not print when current version is newer', async () => {
    getMock = (_url, _opts, cb) => {
      const res = new Readable({ read() {} }) as Readable & { statusCode: number };
      res.statusCode = 200;
      cb(res);
      res.push(JSON.stringify({ version: '1.0.0' }));
      res.push(null);
      return fakeReq();
    };

    checkForUpdate('2.0.0');
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not print on non-200 response', async () => {
    getMock = (_url, _opts, cb) => {
      const res = new Readable({ read() {} }) as Readable & { statusCode: number };
      res.statusCode = 404;
      cb(res);
      res.push(null);
      return fakeReq();
    };

    checkForUpdate('1.0.0');
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not print on invalid JSON', async () => {
    getMock = (_url, _opts, cb) => {
      const res = new Readable({ read() {} }) as Readable & { statusCode: number };
      res.statusCode = 200;
      cb(res);
      res.push('not json');
      res.push(null);
      return fakeReq();
    };

    checkForUpdate('1.0.0');
    await new Promise((r) => setTimeout(r, 50));

    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('does not throw on network error', () => {
    getMock = () => {
      const req = fakeReq();
      process.nextTick(() => req.emit('error', new Error('ENOTFOUND')));
      return req;
    };

    expect(() => checkForUpdate('1.0.0')).not.toThrow();
  });
});
