import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';

/**
 * Seed the storage with default scenarios when it is empty.
 * Currently a no-op — seed data will be added in a future iteration.
 */
export async function seedIfEmpty(storage: IStorage, logger: ILogger): Promise<void> {
  const scenarios = await storage.listScenarios();
  if (scenarios.length > 0) return;

  // TODO: Add seed scenarios when ready
  logger.info(
    'No scenarios found. Create scenarios via UI or write JSON to .claude-test-bench/scenarios/custom/',
  );
}
