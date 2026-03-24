// ---------------------------------------------------------------------------
// Environment variable construction for SDK runs
// ---------------------------------------------------------------------------

import type { ProviderConfig } from '../types/index.js';

/**
 * Environment variables safe to inherit from the host process.
 * Kept minimal to avoid leaking secrets.
 */
const ENV_ALLOWLIST: readonly string[] = [
  'HOME',
  'PATH',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'NODE_ENV',
  'TMPDIR',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
] as const;

/**
 * Build a clean environment for an SDK run.
 *
 * - Copies only allow-listed variables from `process.env`
 * - Injects authentication variables based on provider kind
 * - Sets ANTHROPIC_DEFAULT_*_MODEL to the configured model
 */
export function buildRunEnv(provider: ProviderConfig): Record<string, string> {
  const env: Record<string, string> = {};

  // Copy safe host variables
  for (const key of ENV_ALLOWLIST) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }

  // Provider-specific auth
  if (provider.kind === 'api') {
    env['ANTHROPIC_API_KEY'] = provider.apiKey;
    env['ANTHROPIC_BASE_URL'] = provider.baseUrl;
  } else {
    env['CLAUDE_CODE_OAUTH_TOKEN'] = provider.oauthToken;
  }

  // Set all default model slots to the configured model
  env['ANTHROPIC_DEFAULT_MODEL'] = provider.model;
  env['ANTHROPIC_DEFAULT_FAST_MODEL'] = provider.model;
  env['ANTHROPIC_DEFAULT_SLOW_MODEL'] = provider.model;

  return env;
}
