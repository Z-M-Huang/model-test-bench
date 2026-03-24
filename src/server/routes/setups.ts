import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { TestSetup, ProviderConfig, PermissionMode } from '../types/index.js';

// ─── Helpers ───────────────────────────────────────────────────────────

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

function maskSecret(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

function maskSetup(setup: TestSetup): Record<string, unknown> {
  const provider = { ...setup.provider };
  if (provider.kind === 'api') {
    return {
      ...setup,
      provider: { ...provider, apiKey: maskSecret(provider.apiKey) },
    };
  }
  // oauth
  return {
    ...setup,
    provider: { ...provider, oauthToken: maskSecret(provider.oauthToken) },
  };
}

function maskSetupMetadata(setup: TestSetup): Record<string, unknown> {
  return {
    id: setup.id,
    name: setup.name,
    providerType: setup.provider.kind,
    model: setup.provider.model,
    createdAt: setup.createdAt,
  };
}

interface ValidationError {
  readonly field: string;
  readonly message: string;
}

function validateProviderConfig(provider: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof provider !== 'object' || provider === null) {
    errors.push({ field: 'provider', message: 'provider is required and must be an object' });
    return errors;
  }
  const p = provider as Record<string, unknown>;
  if (p.kind !== 'api' && p.kind !== 'oauth') {
    errors.push({ field: 'provider.kind', message: "provider.kind must be 'api' or 'oauth'" });
    return errors;
  }
  if (typeof p.model !== 'string' || p.model.length === 0) {
    errors.push({ field: 'provider.model', message: 'provider.model is required' });
  }
  if (p.kind === 'api') {
    if (typeof p.apiKey !== 'string' || p.apiKey.length === 0) {
      errors.push({ field: 'provider.apiKey', message: 'provider.apiKey is required for api provider' });
    }
    if (typeof p.baseUrl !== 'string' || p.baseUrl.length === 0) {
      errors.push({ field: 'provider.baseUrl', message: 'provider.baseUrl is required for api provider' });
    }
  }
  if (p.kind === 'oauth') {
    if (typeof p.oauthToken !== 'string' || p.oauthToken.length === 0) {
      errors.push({ field: 'provider.oauthToken', message: 'provider.oauthToken is required for oauth provider' });
    }
  }
  return errors;
}

function validateSetupBody(body: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof body !== 'object' || body === null) {
    errors.push({ field: 'body', message: 'Request body must be a JSON object' });
    return errors;
  }
  const b = body as Record<string, unknown>;

  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'name is required' });
  }
  errors.push(...validateProviderConfig(b.provider));

  if (Array.isArray(b.claudeMdFiles) && b.claudeMdFiles.length > 2) {
    errors.push({ field: 'claudeMdFiles', message: 'claudeMdFiles cannot exceed 2 entries' });
  }
  if (b.timeoutSeconds !== undefined) {
    if (typeof b.timeoutSeconds !== 'number' || b.timeoutSeconds <= 0) {
      errors.push({ field: 'timeoutSeconds', message: 'timeoutSeconds must be a positive number' });
    }
  }
  return errors;
}

// ─── Router factory ────────────────────────────────────────────────────

export function createSetupRoutes(storage: IStorage, logger: ILogger): Router {
  const router = Router();

  // GET / — list all setups (metadata only)
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const setups = await storage.listSetups();
      res.json(setups.map(maskSetupMetadata));
    } catch (err) {
      logger.error('Failed to list setups', { error: String(err) });
      res.status(500).json({ error: 'Failed to list setups' });
    }
  });

  // GET /:id — get full setup (with masked secrets)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const setup = await storage.getSetup(id);
      if (!setup) {
        res.status(404).json({ error: 'Setup not found' });
        return;
      }
      res.json(maskSetup(setup));
    } catch (err) {
      logger.error('Failed to get setup', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to get setup' });
    }
  });

  // POST / — create setup
  router.post('/', async (req: Request, res: Response) => {
    const errors = validateSetupBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }
    try {
      const body = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const setup: TestSetup = {
        id: uuidv4(),
        name: (body.name as string).trim(),
        description: (body.description as string | undefined) ?? '',
        provider: body.provider as ProviderConfig,
        claudeMdFiles: Array.isArray(body.claudeMdFiles) ? body.claudeMdFiles : [],
        rules: Array.isArray(body.rules) ? body.rules : [],
        skills: Array.isArray(body.skills) ? body.skills : [],
        subagents: Array.isArray(body.subagents) ? body.subagents : [],
        mcpServers: Array.isArray(body.mcpServers) ? body.mcpServers : [],
        permissionMode: (body.permissionMode as PermissionMode | undefined) ?? 'default',
        maxTurns: typeof body.maxTurns === 'number' ? body.maxTurns : undefined,
        maxBudgetUsd: typeof body.maxBudgetUsd === 'number' ? body.maxBudgetUsd : undefined,
        timeoutSeconds: typeof body.timeoutSeconds === 'number' ? body.timeoutSeconds : 300,
        allowedTools: Array.isArray(body.allowedTools) ? body.allowedTools : undefined,
        thinking: body.thinking as TestSetup['thinking'],
        effort: body.effort as TestSetup['effort'],
        createdAt: now,
        updatedAt: now,
      };
      await storage.saveSetup(setup);
      res.status(201).json(maskSetup(setup));
    } catch (err) {
      logger.error('Failed to create setup', { error: String(err) });
      res.status(500).json({ error: 'Failed to create setup' });
    }
  });

  // PUT /:id — update setup
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await storage.getSetup(id);
      if (!existing) {
        res.status(404).json({ error: 'Setup not found' });
        return;
      }
      const errors = validateSetupBody(req.body);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const updated: TestSetup = {
        id: existing.id,
        createdAt: existing.createdAt,
        name: (body.name as string).trim(),
        description: (body.description as string | undefined) ?? '',
        provider: body.provider as ProviderConfig,
        claudeMdFiles: Array.isArray(body.claudeMdFiles) ? body.claudeMdFiles : [],
        rules: Array.isArray(body.rules) ? body.rules : [],
        skills: Array.isArray(body.skills) ? body.skills : [],
        subagents: Array.isArray(body.subagents) ? body.subagents : [],
        mcpServers: Array.isArray(body.mcpServers) ? body.mcpServers : [],
        permissionMode: (body.permissionMode as PermissionMode | undefined) ?? 'default',
        maxTurns: typeof body.maxTurns === 'number' ? body.maxTurns : undefined,
        maxBudgetUsd: typeof body.maxBudgetUsd === 'number' ? body.maxBudgetUsd : undefined,
        timeoutSeconds: typeof body.timeoutSeconds === 'number' ? body.timeoutSeconds : 300,
        allowedTools: Array.isArray(body.allowedTools) ? body.allowedTools : undefined,
        thinking: body.thinking as TestSetup['thinking'],
        effort: body.effort as TestSetup['effort'],
        updatedAt: new Date().toISOString(),
      };
      await storage.saveSetup(updated);
      res.json(maskSetup(updated));
    } catch (err) {
      logger.error('Failed to update setup', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to update setup' });
    }
  });

  // DELETE /:id — delete setup
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const deleted = await storage.deleteSetup(id);
      if (!deleted) {
        res.status(404).json({ error: 'Setup not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error('Failed to delete setup', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to delete setup' });
    }
  });

  return router;
}
