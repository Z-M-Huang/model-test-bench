import https from 'node:https';

export function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

export function checkForUpdate(currentVersion: string): void {
  const req = https.get(
    'https://registry.npmjs.org/claude-test-bench/latest',
    { timeout: 3000, headers: { Accept: 'application/json' } },
    (res) => {
      if (res.statusCode !== 200) return;
      let body = '';
      res.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      res.on('end', () => {
        try {
          const data = JSON.parse(body) as { version?: string };
          const latest = data.version;
          if (latest && latest !== currentVersion && isNewer(latest, currentVersion)) {
            console.log(
              `\n  Update available: ${currentVersion} → \x1b[32m${latest}\x1b[0m` +
              `\n  Run \x1b[36mnpm install -g claude-test-bench\x1b[0m to update\n`,
            );
          }
        } catch { /* ignore parse errors */ }
      });
    },
  );
  req.on('error', () => { /* silent — network may be unavailable */ });
  req.setTimeout(3000, () => req.destroy());
}
