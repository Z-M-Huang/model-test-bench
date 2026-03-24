import fs from 'node:fs/promises';

/** File system abstraction for testing */
export interface FsAdapter {
  mkdir(dirPath: string, opts: { recursive: boolean }): Promise<void>;
  writeFile(filePath: string, data: string, opts?: { mode?: number }): Promise<void>;
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  readdir(dirPath: string): Promise<string[]>;
  unlink(filePath: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  stat(filePath: string): Promise<{ isFile(): boolean }>;
  access(filePath: string): Promise<void>;
}

/** Default adapter that delegates to node:fs/promises */
export const defaultFs: FsAdapter = {
  mkdir: (dirPath, opts) => fs.mkdir(dirPath, opts).then(() => undefined),
  writeFile: (filePath, data, opts) =>
    fs.writeFile(filePath, data, opts).then(() => undefined),
  readFile: (filePath, encoding) => fs.readFile(filePath, encoding),
  readdir: (dirPath) => fs.readdir(dirPath).then((entries) => entries.map(String)),
  unlink: (filePath) => fs.unlink(filePath),
  rename: (oldPath, newPath) => fs.rename(oldPath, newPath),
  stat: (filePath) => fs.stat(filePath),
  access: (filePath) => fs.access(filePath),
};
