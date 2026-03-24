import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Scenario, ScenarioCategory, ScoringDimension } from '../types/index.js';

// ─── Helpers ───────────────────────────────────────────────────────────

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

const VALID_CATEGORIES: readonly ScenarioCategory[] = [
  'planning', 'instruction-following', 'reasoning', 'tool-strategy',
  'error-handling', 'ambiguity-handling', 'scope-management', 'custom',
];

interface ValidationError {
  readonly field: string;
  readonly message: string;
}

function scenarioMetadata(s: Scenario): Record<string, unknown> {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    builtIn: s.builtIn,
    createdAt: s.createdAt,
  };
}

function validateScoringWeights(dimensions: readonly ScoringDimension[]): boolean {
  if (dimensions.length === 0) return true;
  const sum = dimensions.reduce((acc, d) => acc + d.weight, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

function validateScenarioBody(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof body !== 'object' || body === null) {
    errors.push({ field: 'body', message: 'Request body must be a JSON object' });
    return errors;
  }
  const b = body as Record<string, unknown>;

  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name is required' });
  }
  if (typeof b.prompt !== 'string' || b.prompt.trim().length === 0) {
    errors.push({ field: 'prompt', message: 'prompt is required' });
  }
  if (typeof b.category !== 'string' || !VALID_CATEGORIES.includes(b.category as ScenarioCategory)) {
    errors.push({
      field: 'category',
      message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
    });
  }
  if (Array.isArray(b.scoringDimensions) && b.scoringDimensions.length > 0) {
    if (!validateScoringWeights(b.scoringDimensions as ScoringDimension[])) {
      errors.push({
        field: 'scoringDimensions',
        message: 'scoringDimensions weights must sum to 1.0',
      });
    }
  }
  return errors;
}

// ─── Router factory ────────────────────────────────────────────────────

export function createScenarioRoutes(storage: IStorage, logger: ILogger): Router {
  const router = Router();

  // GET / — list all scenarios (metadata only)
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const scenarios = await storage.listScenarios();
      res.json(scenarios.map(scenarioMetadata));
    } catch (err) {
      logger.error('Failed to list scenarios', { error: String(err) });
      res.status(500).json({ error: 'Failed to list scenarios' });
    }
  });

  // GET /:id — get full scenario
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const scenario = await storage.getScenario(id);
      if (!scenario) {
        res.status(404).json({ error: 'Scenario not found' });
        return;
      }
      res.json(scenario);
    } catch (err) {
      logger.error('Failed to get scenario', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to get scenario' });
    }
  });

  // POST / — create custom scenario
  router.post('/', async (req: Request, res: Response) => {
    const errors = validateScenarioBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }
    try {
      const body = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const scenario: Scenario = {
        id: uuidv4(),
        name: (body.name as string).trim(),
        category: body.category as ScenarioCategory,
        builtIn: false,
        prompt: (body.prompt as string).trim(),
        workspaceFiles: Array.isArray(body.workspaceFiles) ? body.workspaceFiles : [],
        expectedAnswer: typeof body.expectedAnswer === 'string' ? body.expectedAnswer : '',
        criticalRequirements: Array.isArray(body.criticalRequirements) ? body.criticalRequirements : [],
        gradingGuidelines: typeof body.gradingGuidelines === 'string' ? body.gradingGuidelines : '',
        scoringDimensions: Array.isArray(body.scoringDimensions) ? body.scoringDimensions : [],
        createdAt: now,
        updatedAt: now,
      };
      await storage.saveScenario(scenario);
      res.status(201).json(scenario);
    } catch (err) {
      logger.error('Failed to create scenario', { error: String(err) });
      res.status(500).json({ error: 'Failed to create scenario' });
    }
  });

  // PUT /:id — update custom scenario
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await storage.getScenario(id);
      if (!existing) {
        res.status(404).json({ error: 'Scenario not found' });
        return;
      }
      const errors = validateScenarioBody(req.body);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const updated: Scenario = {
        ...existing,
        name: (body.name as string).trim(),
        category: body.category as ScenarioCategory,
        prompt: (body.prompt as string).trim(),
        workspaceFiles: Array.isArray(body.workspaceFiles) ? body.workspaceFiles : existing.workspaceFiles,
        expectedAnswer: typeof body.expectedAnswer === 'string' ? body.expectedAnswer : existing.expectedAnswer,
        criticalRequirements: Array.isArray(body.criticalRequirements)
          ? body.criticalRequirements
          : existing.criticalRequirements,
        gradingGuidelines: typeof body.gradingGuidelines === 'string'
          ? body.gradingGuidelines
          : existing.gradingGuidelines,
        scoringDimensions: Array.isArray(body.scoringDimensions)
          ? body.scoringDimensions
          : existing.scoringDimensions,
        updatedAt: new Date().toISOString(),
      };
      await storage.saveScenario(updated);
      res.json(updated);
    } catch (err) {
      logger.error('Failed to update scenario', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to update scenario' });
    }
  });

  // DELETE /:id — delete custom scenario
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await storage.getScenario(id);
      if (!existing) {
        res.status(404).json({ error: 'Scenario not found' });
        return;
      }
      await storage.deleteScenario(id);
      res.status(204).send();
    } catch (err) {
      logger.error('Failed to delete scenario', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to delete scenario' });
    }
  });

  return router;
}
