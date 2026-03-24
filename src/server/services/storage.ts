import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { IStorage, SetupFilter, ScenarioFilter, RunFilter, EvaluationFilter } from '../interfaces/storage.js';
import type {
  TestSetup,
  Scenario,
  Run,
  Evaluation,
} from '../types/index.js';
import { defaultFs } from './fs-adapter.js';
import type { FsAdapter } from './fs-adapter.js';

interface EntityConfig<T, F> {
  subdir: string;
  matchesFilter: (entity: T, filter?: F) => boolean;
  sensitive: boolean;
}

export class JsonFileStorage implements IStorage {
  private readonly basePath: string;
  private readonly builtInScenariosDir: string | undefined;
  private readonly fs: FsAdapter;
  private initialized = false;

  private readonly entities: {
    setups: EntityConfig<TestSetup, SetupFilter>;
    scenarios: EntityConfig<Scenario, ScenarioFilter>;
    runs: EntityConfig<Run, RunFilter>;
    evaluations: EntityConfig<Evaluation, EvaluationFilter>;
  };

  constructor(basePath?: string, fsAdapter?: FsAdapter, builtInScenariosDir?: string) {
    this.basePath = basePath ?? path.join(os.homedir(), '.claude-test-bench');
    this.builtInScenariosDir = builtInScenariosDir;
    this.fs = fsAdapter ?? defaultFs;

    this.entities = {
      setups: {
        subdir: 'setups',
        sensitive: true,
        matchesFilter: (s: TestSetup, f?: SetupFilter) => {
          if (!f) return true;
          if (f.provider && s.provider.kind !== f.provider) return false;
          if (f.model && s.provider.model !== f.model) return false;
          return true;
        },
      },
      scenarios: {
        subdir: 'scenarios/custom',
        sensitive: false,
        matchesFilter: (s: Scenario, f?: ScenarioFilter) => {
          if (!f) return true;
          if (f.category && s.category !== f.category) return false;
          if (f.builtIn !== undefined && s.builtIn !== f.builtIn) return false;
          return true;
        },
      },
      runs: {
        subdir: 'runs',
        sensitive: false,
        matchesFilter: (r: Run, f?: RunFilter) => {
          if (!f) return true;
          if (f.setupId && r.setupId !== f.setupId) return false;
          if (f.scenarioId && r.scenarioId !== f.scenarioId) return false;
          if (f.status && r.status !== f.status) return false;
          return true;
        },
      },
      evaluations: {
        subdir: 'evaluations',
        sensitive: false,
        matchesFilter: (e: Evaluation, f?: EvaluationFilter) => {
          if (!f) return true;
          if (f.runId && e.runId !== f.runId) return false;
          if (f.status && e.status !== f.status) return false;
          return true;
        },
      },
    };
  }

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    for (const cfg of Object.values(this.entities)) {
      await this.fs.mkdir(path.join(this.basePath, cfg.subdir), { recursive: true });
    }
    this.initialized = true;
  }

  private entityDir(subdir: string): string {
    return path.join(this.basePath, subdir);
  }

  private entityPath(subdir: string, id: string): string {
    return path.join(this.basePath, subdir, `${id}.json`);
  }

  // ─── Generic CRUD ──────────────────────────────────────────────────

  private async getEntity<T>(subdir: string, id: string): Promise<T | undefined> {
    await this.ensureInit();
    const filePath = this.entityPath(subdir, id);
    try {
      const raw = await this.fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  private async listEntities<T, F>(
    subdir: string,
    matchesFilter: (entity: T, filter?: F) => boolean,
    filter?: F,
  ): Promise<readonly T[]> {
    await this.ensureInit();
    const dir = this.entityDir(subdir);
    let files: string[];
    try {
      files = await this.fs.readdir(dir);
    } catch {
      return [];
    }
    const results: T[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await this.fs.readFile(path.join(dir, file), 'utf-8');
        const entity = JSON.parse(raw) as T;
        if (matchesFilter(entity, filter)) {
          results.push(entity);
        }
      } catch {
        // Skip corrupt files
      }
    }
    return results;
  }

  private async saveEntity<T extends { id: string }>(
    subdir: string,
    entity: T,
    sensitive: boolean,
  ): Promise<void> {
    await this.ensureInit();
    const dir = this.entityDir(subdir);
    const tmpPath = path.join(dir, `.tmp-${randomUUID()}.json`);
    const finalPath = this.entityPath(subdir, entity.id);
    const data = JSON.stringify(entity, null, 2);
    const opts = sensitive ? { mode: 0o600 } : undefined;
    await this.fs.writeFile(tmpPath, data, opts);
    await this.fs.rename(tmpPath, finalPath);
  }

  private async deleteEntity(subdir: string, id: string): Promise<boolean> {
    await this.ensureInit();
    const filePath = this.entityPath(subdir, id);
    try {
      await this.fs.access(filePath);
      await this.fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Setups ────────────────────────────────────────────────────────

  getSetup(id: string): Promise<TestSetup | undefined> {
    return this.getEntity<TestSetup>(this.entities.setups.subdir, id);
  }

  listSetups(filter?: SetupFilter): Promise<readonly TestSetup[]> {
    const cfg = this.entities.setups;
    return this.listEntities<TestSetup, SetupFilter>(cfg.subdir, cfg.matchesFilter, filter);
  }

  saveSetup(setup: TestSetup): Promise<void> {
    const cfg = this.entities.setups;
    return this.saveEntity(cfg.subdir, setup, cfg.sensitive);
  }

  deleteSetup(id: string): Promise<boolean> {
    return this.deleteEntity(this.entities.setups.subdir, id);
  }

  // ─── Built-in scenarios helpers ───────────────────────────────────

  private builtInCache: Map<string, Scenario> | undefined;

  private async ensureBuiltInCache(): Promise<Map<string, Scenario>> {
    if (this.builtInCache) return this.builtInCache;
    this.builtInCache = new Map();
    if (!this.builtInScenariosDir) return this.builtInCache;
    let files: string[];
    try {
      files = await this.fs.readdir(this.builtInScenariosDir);
    } catch {
      return this.builtInCache;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await this.fs.readFile(
          path.join(this.builtInScenariosDir, file),
          'utf-8',
        );
        const scenario = JSON.parse(raw) as Scenario;
        this.builtInCache.set(scenario.id, scenario);
      } catch {
        // Skip corrupt files
      }
    }
    return this.builtInCache;
  }

  private async getBuiltInScenario(id: string): Promise<Scenario | undefined> {
    const cache = await this.ensureBuiltInCache();
    return cache.get(id);
  }

  private async isBuiltInScenario(id: string): Promise<boolean> {
    return (await this.getBuiltInScenario(id)) !== undefined;
  }

  // ─── Scenarios ─────────────────────────────────────────────────────

  async getScenario(id: string): Promise<Scenario | undefined> {
    const builtIn = await this.getBuiltInScenario(id);
    if (builtIn) return builtIn;
    return this.getEntity<Scenario>(this.entities.scenarios.subdir, id);
  }

  async listScenarios(filter?: ScenarioFilter): Promise<readonly Scenario[]> {
    const cfg = this.entities.scenarios;
    const custom = await this.listEntities<Scenario, ScenarioFilter>(
      cfg.subdir,
      cfg.matchesFilter,
      filter,
    );
    const cache = await this.ensureBuiltInCache();
    const filteredBuiltIn = Array.from(cache.values()).filter((s) =>
      cfg.matchesFilter(s, filter),
    );

    // Built-in IDs take precedence; exclude custom scenarios that shadow a built-in ID
    const builtInIds = new Set(filteredBuiltIn.map((s) => s.id));
    const deduped = custom.filter((s) => !builtInIds.has(s.id));

    return [...filteredBuiltIn, ...deduped];
  }

  async saveScenario(scenario: Scenario): Promise<void> {
    if (await this.isBuiltInScenario(scenario.id)) {
      throw new Error('Cannot modify a built-in scenario');
    }
    const cfg = this.entities.scenarios;
    return this.saveEntity(cfg.subdir, scenario, cfg.sensitive);
  }

  async deleteScenario(id: string): Promise<boolean> {
    if (await this.isBuiltInScenario(id)) {
      throw new Error('Cannot delete a built-in scenario');
    }
    return this.deleteEntity(this.entities.scenarios.subdir, id);
  }

  // ─── Runs ──────────────────────────────────────────────────────────
  getRun(id: string): Promise<Run | undefined> { return this.getEntity(this.entities.runs.subdir, id); }
  listRuns(filter?: RunFilter): Promise<readonly Run[]> { return this.listEntities(this.entities.runs.subdir, this.entities.runs.matchesFilter, filter); }
  saveRun(run: Run): Promise<void> { return this.saveEntity(this.entities.runs.subdir, run, this.entities.runs.sensitive); }
  deleteRun(id: string): Promise<boolean> { return this.deleteEntity(this.entities.runs.subdir, id); }

  // ─── Evaluations ───────────────────────────────────────────────────
  getEvaluation(id: string): Promise<Evaluation | undefined> { return this.getEntity(this.entities.evaluations.subdir, id); }
  listEvaluations(filter?: EvaluationFilter): Promise<readonly Evaluation[]> { return this.listEntities(this.entities.evaluations.subdir, this.entities.evaluations.matchesFilter, filter); }
  saveEvaluation(evaluation: Evaluation): Promise<void> { return this.saveEntity(this.entities.evaluations.subdir, evaluation, this.entities.evaluations.sensitive); }
  deleteEvaluation(id: string): Promise<boolean> { return this.deleteEntity(this.entities.evaluations.subdir, id); }
}
