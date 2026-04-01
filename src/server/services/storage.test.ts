/* eslint-disable @typescript-eslint/unbound-method -- vi.fn() mocks don't have this-binding issues */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JsonFileStorage } from './storage.js';
import { createMockFs, makeProvider, makeScenario, makeRun, makeEvaluation } from './storage-test-helpers.js';

describe('JsonFileStorage', () => {
  let mockFsData: ReturnType<typeof createMockFs>;
  let storage: JsonFileStorage;

  beforeEach(() => {
    mockFsData = createMockFs();
    storage = new JsonFileStorage('/test-base', mockFsData.fs);
  });

  // ─── Initialization ────────────────────────────────────────────

  it('creates subdirectories on first operation', async () => {
    await storage.listProviders();

    expect(mockFsData.fs.mkdir).toHaveBeenCalledWith(
      '/test-base/providers',
      { recursive: true },
    );
    expect(mockFsData.fs.mkdir).toHaveBeenCalledWith(
      '/test-base/scenarios/custom',
      { recursive: true },
    );
    expect(mockFsData.fs.mkdir).toHaveBeenCalledWith(
      '/test-base/runs',
      { recursive: true },
    );
    expect(mockFsData.fs.mkdir).toHaveBeenCalledWith(
      '/test-base/evaluations',
      { recursive: true },
    );
  });

  it('only initializes subdirectories once', async () => {
    await storage.listProviders();
    await storage.listProviders();
    expect(mockFsData.fs.mkdir).toHaveBeenCalledTimes(4);
  });

  // ─── Providers CRUD ─────────────────────────────────────────────

  describe('providers', () => {
    it('saves and retrieves a provider', async () => {
      const provider = makeProvider();
      await storage.saveProvider(provider);
      const retrieved = await storage.getProvider('provider-1');
      expect(retrieved).toEqual(provider);
    });

    it('uses atomic write (temp + rename) for saves', async () => {
      await storage.saveProvider(makeProvider());
      expect(mockFsData.fs.writeFile).toHaveBeenCalledTimes(1);
      expect(mockFsData.fs.rename).toHaveBeenCalledTimes(1);
      const writePath = (mockFsData.fs.writeFile as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as string;
      expect(writePath).toContain('.tmp-');
    });

    it('writes provider files with mode 0o600 (sensitive)', async () => {
      await storage.saveProvider(makeProvider());
      const opts = (mockFsData.fs.writeFile as ReturnType<typeof vi.fn>)
        .mock.calls[0][2] as { mode: number } | undefined;
      expect(opts?.mode).toBe(0o600);
    });

    it('returns undefined for non-existent provider', async () => {
      const result = await storage.getProvider('nonexistent');
      expect(result).toBeUndefined();
    });

    it('lists all providers', async () => {
      await storage.saveProvider(makeProvider({ id: 'provider-1' }));
      await storage.saveProvider(makeProvider({ id: 'provider-2', name: 'Second' }));
      const all = await storage.listProviders();
      expect(all).toHaveLength(2);
    });

    it('filters providers by providerName', async () => {
      await storage.saveProvider(makeProvider({ id: 's1', providerName: 'anthropic' }));
      await storage.saveProvider(makeProvider({ id: 's2', providerName: 'openai' }));
      const filtered = await storage.listProviders({ provider: 'anthropic' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('s1');
    });

    it('filters providers by model', async () => {
      await storage.saveProvider(makeProvider({ id: 's1', model: 'claude-sonnet-4-6' }));
      await storage.saveProvider(makeProvider({ id: 's2', model: 'claude-opus-4' }));
      const filtered = await storage.listProviders({ model: 'claude-opus-4' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('s2');
    });

    it('deletes an existing provider', async () => {
      await storage.saveProvider(makeProvider());
      const deleted = await storage.deleteProvider('provider-1');
      expect(deleted).toBe(true);
      expect(await storage.getProvider('provider-1')).toBeUndefined();
    });

    it('returns false when deleting non-existent provider', async () => {
      expect(await storage.deleteProvider('nonexistent')).toBe(false);
    });
  });

  // ─── Scenarios CRUD ────────────────────────────────────────────

  describe('scenarios', () => {
    it('saves and retrieves a scenario', async () => {
      const scenario = makeScenario();
      await storage.saveScenario(scenario);
      expect(await storage.getScenario('scenario-1')).toEqual(scenario);
    });

    it('does not write scenario files with mode 0o600', async () => {
      await storage.saveScenario(makeScenario());
      const opts = (mockFsData.fs.writeFile as ReturnType<typeof vi.fn>)
        .mock.calls[0][2] as { mode: number } | undefined;
      expect(opts).toBeUndefined();
    });

    it('filters scenarios by category', async () => {
      await storage.saveScenario(makeScenario({ id: 's1', category: 'planning' }));
      await storage.saveScenario(makeScenario({ id: 's2', category: 'reasoning' }));
      const filtered = await storage.listScenarios({ category: 'planning' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('s1');
    });

    it('deletes a scenario', async () => {
      await storage.saveScenario(makeScenario());
      expect(await storage.deleteScenario('scenario-1')).toBe(true);
    });

    it('returns false when deleting non-existent scenario', async () => {
      expect(await storage.deleteScenario('nonexistent')).toBe(false);
    });
  });

  // ─── Runs CRUD ─────────────────────────────────────────────────

  describe('runs', () => {
    it('saves and retrieves a run', async () => {
      const run = makeRun();
      await storage.saveRun(run);
      expect(await storage.getRun('run-1')).toEqual(run);
    });

    it('lists all runs', async () => {
      await storage.saveRun(makeRun({ id: 'r1' }));
      await storage.saveRun(makeRun({ id: 'r2' }));
      expect(await storage.listRuns()).toHaveLength(2);
    });

    it('filters runs by providerId', async () => {
      await storage.saveRun(makeRun({ id: 'r1', providerId: 'sa' }));
      await storage.saveRun(makeRun({ id: 'r2', providerId: 'sb' }));
      const filtered = await storage.listRuns({ providerId: 'sa' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('r1');
    });

    it('filters runs by scenarioId', async () => {
      await storage.saveRun(makeRun({ id: 'r1', scenarioId: 'sc1' }));
      await storage.saveRun(makeRun({ id: 'r2', scenarioId: 'sc2' }));
      expect(await storage.listRuns({ scenarioId: 'sc1' })).toHaveLength(1);
    });

    it('filters runs by status', async () => {
      await storage.saveRun(makeRun({ id: 'r1', status: 'completed' }));
      await storage.saveRun(makeRun({ id: 'r2', status: 'failed' }));
      const filtered = await storage.listRuns({ status: 'failed' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('r2');
    });

    it('deletes a run', async () => {
      await storage.saveRun(makeRun());
      expect(await storage.deleteRun('run-1')).toBe(true);
    });

    it('returns false when deleting non-existent run', async () => {
      expect(await storage.deleteRun('nonexistent')).toBe(false);
    });
  });

  // ─── Evaluations CRUD ──────────────────────────────────────────

  describe('evaluations', () => {
    it('saves and retrieves an evaluation', async () => {
      const evaluation = makeEvaluation();
      await storage.saveEvaluation(evaluation);
      const retrieved = await storage.getEvaluation('eval-1');
      // ReadonlyMap doesn't survive JSON round-trip; compare key fields
      expect(retrieved?.id).toBe(evaluation.id);
      expect(retrieved?.runId).toBe(evaluation.runId);
      expect(retrieved?.status).toBe(evaluation.status);
      expect(retrieved?.totalCostUsd).toBe(evaluation.totalCostUsd);
    });

    it('lists all evaluations', async () => {
      await storage.saveEvaluation(makeEvaluation({ id: 'e1' }));
      await storage.saveEvaluation(makeEvaluation({ id: 'e2' }));
      expect(await storage.listEvaluations()).toHaveLength(2);
    });

    it('filters evaluations by runId', async () => {
      await storage.saveEvaluation(makeEvaluation({ id: 'e1', runId: 'r1' }));
      await storage.saveEvaluation(makeEvaluation({ id: 'e2', runId: 'r2' }));
      const filtered = await storage.listEvaluations({ runId: 'r1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('e1');
    });

    it('filters evaluations by status', async () => {
      await storage.saveEvaluation(makeEvaluation({ id: 'e1', status: 'completed' }));
      await storage.saveEvaluation(makeEvaluation({ id: 'e2', status: 'failed' }));
      const filtered = await storage.listEvaluations({ status: 'failed' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('e2');
    });

    it('deletes an evaluation', async () => {
      await storage.saveEvaluation(makeEvaluation());
      expect(await storage.deleteEvaluation('eval-1')).toBe(true);
    });

    it('returns false when deleting non-existent evaluation', async () => {
      expect(await storage.deleteEvaluation('nonexistent')).toBe(false);
    });
  });

  // ─── Edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty directory listing', async () => {
      expect(await storage.listProviders()).toEqual([]);
    });

    it('skips non-json files in directory listing', async () => {
      mockFsData.state.files.set('/test-base/providers/readme.txt', 'not json');
      await storage.saveProvider(makeProvider());
      expect(await storage.listProviders()).toHaveLength(1);
    });

    it('skips corrupt json files gracefully', async () => {
      mockFsData.state.files.set('/test-base/providers/bad.json', '{corrupt');
      await storage.saveProvider(makeProvider());
      expect(await storage.listProviders()).toHaveLength(1);
    });

    it('overwrites existing entity on save', async () => {
      await storage.saveProvider(makeProvider({ id: 'provider-1', name: 'V1' }));
      await storage.saveProvider(makeProvider({ id: 'provider-1', name: 'V2' }));
      expect((await storage.getProvider('provider-1'))?.name).toBe('V2');
    });

    it('returns empty list with no filter', async () => {
      expect(await storage.listRuns()).toEqual([]);
    });

    it('returns all items when filter has no matching criteria', async () => {
      await storage.saveRun(makeRun({ id: 'r1' }));
      await storage.saveRun(makeRun({ id: 'r2' }));
      expect(await storage.listRuns({})).toHaveLength(2);
    });

    it('returns empty list when readdir throws', async () => {
      (mockFsData.fs.readdir as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('ENOENT: no such directory'),
      );
      const freshStorage = new JsonFileStorage('/test-base', mockFsData.fs);
      expect(await freshStorage.listProviders()).toEqual([]);
    });
  });

});
