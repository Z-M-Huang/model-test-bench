import fs from 'node:fs';
import path from 'node:path';

export interface RotationConfig {
  /** Maximum file size in bytes before rotation (default: 2MB). */
  maxBytes: number;
  /** Maximum number of rotated files to keep (default: 25). */
  maxFiles: number;
}

export const DEFAULT_ROTATION: RotationConfig = {
  maxBytes: 2 * 1024 * 1024,  // 2 MB
  maxFiles: 25,
};

/**
 * Rotate a log file if it exceeds `config.maxBytes`.
 *
 * Rotation scheme (e.g. for ctb.log):
 *   ctb.24.log  → deleted
 *   ctb.23.log  → ctb.24.log
 *   ...
 *   ctb.1.log   → ctb.2.log
 *   ctb.log     → ctb.1.log
 *   (a fresh ctb.log is NOT created here — the caller appends)
 */
export function rotateIfNeeded(
  filePath: string,
  config: RotationConfig = DEFAULT_ROTATION,
): void {
  let size: number;
  try {
    const stat = fs.statSync(filePath);
    size = stat.size;
  } catch {
    // File does not exist yet — nothing to rotate.
    return;
  }

  if (size < config.maxBytes) return;

  const dir = path.dirname(filePath);
  const ext = path.extname(filePath);           // .log
  const base = path.basename(filePath, ext);     // ctb

  // Shift numbered files: N → N+1.  Delete the oldest if at maxFiles.
  for (let i = config.maxFiles; i >= 1; i--) {
    const src = path.join(dir, `${base}.${i}${ext}`);
    if (i === config.maxFiles) {
      // Delete the oldest file
      try { fs.unlinkSync(src); } catch { /* noop */ }
    } else {
      const dst = path.join(dir, `${base}.${i + 1}${ext}`);
      try { fs.renameSync(src, dst); } catch { /* noop */ }
    }
  }

  // Move current file → .1
  const firstRotated = path.join(dir, `${base}.1${ext}`);
  try {
    fs.renameSync(filePath, firstRotated);
  } catch {
    // If rename fails, continue — the caller will append to the same file.
  }
}
