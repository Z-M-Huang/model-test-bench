import fs from 'node:fs';
import path from 'node:path';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Scenario } from '../types/index.js';
import type { Provider } from '../types/index.js';

/**
 * Seed files that ship with the project under docs/schemas/.
 * Each entry maps a source file to the storage method used to persist it.
 * Seeding only runs when the respective list is empty — existing data is never overwritten.
 */
const SEED_SCENARIOS = [
  'scenario-baseline.example.json',
  'scenario-with-claude-md.example.json',
];

const SEED_PROVIDERS = [
  'provider-oauth.example.json',
  'provider-api.example.json',
];

function resolveSchemasDir(): string {
  // Try common locations: relative to cwd, relative to this file's compiled location
  const candidates = [
    path.join(process.cwd(), 'docs', 'schemas'),
    path.join(process.cwd(), '..', 'docs', 'schemas'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return candidates[0]; // fallback
}

function loadJsonFile<T>(filePath: string): T | undefined {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Seed storage with example scenarios and providers when empty. */
export async function seedIfEmpty(storage: IStorage, logger: ILogger): Promise<void> {
  const schemasDir = resolveSchemasDir();

  // Seed scenarios
  const existingScenarios = await storage.listScenarios();
  if (existingScenarios.length === 0) {
    let seeded = 0;
    for (const file of SEED_SCENARIOS) {
      const scenario = loadJsonFile<Scenario>(path.join(schemasDir, file));
      if (scenario) {
        await storage.saveScenario(scenario);
        seeded++;
        logger.info('Seeded scenario', { name: scenario.name, id: scenario.id });
      }
    }
    if (seeded === 0) {
      logger.info('No seed scenarios found in ' + schemasDir);
    }
  }

  // Seed providers
  const existingProviders = await storage.listProviders();
  if (existingProviders.length === 0) {
    let seeded = 0;
    for (const file of SEED_PROVIDERS) {
      const provider = loadJsonFile<Provider>(path.join(schemasDir, file));
      if (provider) {
        await storage.saveProvider(provider);
        seeded++;
        logger.info('Seeded provider', { name: provider.name, id: provider.id });
      }
    }
    if (seeded === 0) {
      logger.info('No seed providers found in ' + schemasDir);
    }
  }
}
