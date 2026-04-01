import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IStorage, ProviderFilter, ScenarioFilter, RunFilter, EvaluationFilter } from '../interfaces/storage.js';
import type {
  Provider,
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
  private readonly fs: FsAdapter;
  private initialized = false;

  private readonly entities: {
    providers: EntityConfig<Provider, ProviderFilter>;
    scenarios: EntityConfig<Scenario, ScenarioFilter>;
    runs: EntityConfig<Run, RunFilter>;
    evaluations: EntityConfig<Evaluation, EvaluationFilter>;
  };

  constructor(basePath?: string, fsAdapter?: FsAdapter) {
    this.basePath = basePath ?? path.join(process.cwd(), '.model-test-bench');
    this.fs = fsAdapter ?? defaultFs;

    this.entities = {
      providers: {
        subdir: 'providers',
        sensitive: true,
        matchesFilter: (s: Provider, f?: ProviderFilter) => {
          if (!f) return true;
          if (f.provider && s.providerName !== f.provider) return false;
          if (f.model && s.model !== f.model) return false;
          return true;
        },
      },
      scenarios: {
        subdir: 'scenarios/custom',
        sensitive: false,
        matchesFilter: (s: Scenario, f?: ScenarioFilter) => {
          if (!f) return true;
          if (f.category && s.category !== f.category) return false;
          return true;
        },
      },
      runs: {
        subdir: 'runs',
        sensitive: false,
        matchesFilter: (r: Run, f?: RunFilter) => {
          if (!f) return true;
          if (f.providerId && r.providerId !== f.providerId) return false;
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

    // Migrate legacy 'setups' directory to 'providers'
    const legacyDir = path.join(this.basePath, 'setups');
    const newDir = path.join(this.basePath, 'providers');
    try {
      await this.fs.access(legacyDir);
      try {
        await this.fs.access(newDir);
      } catch {
        // New dir doesn't exist — rename legacy dir
        await this.fs.rename(legacyDir, newDir);
      }
    } catch {
      // Legacy dir doesn't exist — nothing to migrate
    }

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

  // ─── Providers ──────────────────────────────────────────────────────

  getProvider(id: string): Promise<Provider | undefined> {
    return this.getEntity<Provider>(this.entities.providers.subdir, id);
  }

  listProviders(filter?: ProviderFilter): Promise<readonly Provider[]> {
    const cfg = this.entities.providers;
    return this.listEntities<Provider, ProviderFilter>(cfg.subdir, cfg.matchesFilter, filter);
  }

  saveProvider(provider: Provider): Promise<void> {
    const cfg = this.entities.providers;
    return this.saveEntity(cfg.subdir, provider, cfg.sensitive);
  }

  deleteProvider(id: string): Promise<boolean> {
    return this.deleteEntity(this.entities.providers.subdir, id);
  }

  // ─── Scenarios ─────────────────────────────────────────────────────

  getScenario(id: string): Promise<Scenario | undefined> {
    return this.getEntity<Scenario>(this.entities.scenarios.subdir, id);
  }

  listScenarios(filter?: ScenarioFilter): Promise<readonly Scenario[]> {
    const cfg = this.entities.scenarios;
    return this.listEntities<Scenario, ScenarioFilter>(cfg.subdir, cfg.matchesFilter, filter);
  }

  saveScenario(scenario: Scenario): Promise<void> {
    const cfg = this.entities.scenarios;
    return this.saveEntity(cfg.subdir, scenario, cfg.sensitive);
  }

  deleteScenario(id: string): Promise<boolean> {
    return this.deleteEntity(this.entities.scenarios.subdir, id);
  }

  // ─── Runs ──────────────────────────────────────────────────────────
  private normalizeRun(raw: Run): Run {
    // Accept both old and new field names for backward compat
    const r = raw as unknown as Record<string, unknown>;
    if ('setupId' in r && !('providerId' in r)) {
      return {
        ...(raw as Run),
        providerId: r['setupId'] as string,
        providerSnapshot: (r['setupSnapshot'] ?? raw.providerSnapshot) as Run['providerSnapshot'],
        reviewerProviderIds: (r['reviewerSetupIds'] ?? raw.reviewerProviderIds) as Run['reviewerProviderIds'],
        reviewerProviderSnapshots: (r['reviewerSetupSnapshots'] ?? raw.reviewerProviderSnapshots) as Run['reviewerProviderSnapshots'],
      };
    }
    return raw;
  }

  async getRun(id: string): Promise<Run | undefined> {
    const raw = await this.getEntity<Run>(this.entities.runs.subdir, id);
    return raw ? this.normalizeRun(raw) : undefined;
  }
  async listRuns(filter?: RunFilter): Promise<readonly Run[]> {
    const results = await this.listEntities<Run, RunFilter>(this.entities.runs.subdir, this.entities.runs.matchesFilter, filter);
    return results.map((r) => this.normalizeRun(r));
  }
  saveRun(run: Run): Promise<void> { return this.saveEntity(this.entities.runs.subdir, run, this.entities.runs.sensitive); }
  deleteRun(id: string): Promise<boolean> { return this.deleteEntity(this.entities.runs.subdir, id); }

  // ─── Evaluations ───────────────────────────────────────────────────
  getEvaluation(id: string): Promise<Evaluation | undefined> { return this.getEntity(this.entities.evaluations.subdir, id); }
  listEvaluations(filter?: EvaluationFilter): Promise<readonly Evaluation[]> { return this.listEntities(this.entities.evaluations.subdir, this.entities.evaluations.matchesFilter, filter); }
  saveEvaluation(evaluation: Evaluation): Promise<void> { return this.saveEntity(this.entities.evaluations.subdir, evaluation, this.entities.evaluations.sensitive); }
  deleteEvaluation(id: string): Promise<boolean> { return this.deleteEntity(this.entities.evaluations.subdir, id); }
}
