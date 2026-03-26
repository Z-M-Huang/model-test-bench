import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Provider, ProviderConfig } from '../types/index.js';

// ─── Helpers ───────────────────────────────────────────────────────────

function paramId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

function maskSecret(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

function maskProvider(provider: Provider): Record<string, unknown> {
  const cfg = { ...provider.provider };
  if (cfg.kind === 'api') {
    return {
      ...provider,
      provider: { ...cfg, apiKey: maskSecret(cfg.apiKey) },
    };
  }
  // oauth
  return {
    ...provider,
    provider: { ...cfg, oauthToken: maskSecret(cfg.oauthToken) },
  };
}

function maskProviderMetadata(provider: Provider): Record<string, unknown> {
  return {
    id: provider.id,
    name: provider.name,
    providerType: provider.provider.kind,
    model: provider.provider.model,
    createdAt: provider.createdAt,
  };
}

interface ValidationError {
  readonly field: string;
  readonly message: string;
}

function validateProviderConfig(providerCfg: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof providerCfg !== 'object' || providerCfg === null) {
    errors.push({ field: 'provider', message: 'provider is required and must be an object' });
    return errors;
  }
  const p = providerCfg as Record<string, unknown>;
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

function validateProviderBody(body: unknown): ValidationError[] {
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

  if (b.timeoutSeconds !== undefined) {
    if (typeof b.timeoutSeconds !== 'number' || b.timeoutSeconds <= 0) {
      errors.push({ field: 'timeoutSeconds', message: 'timeoutSeconds must be a positive number' });
    }
  }
  return errors;
}

// ─── Router factory ────────────────────────────────────────────────────

export function createProviderRoutes(storage: IStorage, logger: ILogger): Router {
  const router = Router();

  // GET / — list all providers (metadata only)
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const providers = await storage.listProviders();
      res.json(providers.map(maskProviderMetadata));
    } catch (err) {
      logger.error('Failed to list providers', { error: String(err) });
      res.status(500).json({ error: 'Failed to list providers' });
    }
  });

  // GET /:id — get full provider (with masked secrets)
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const provider = await storage.getProvider(id);
      if (!provider) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }
      res.json(maskProvider(provider));
    } catch (err) {
      logger.error('Failed to get provider', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to get provider' });
    }
  });

  // POST / — create provider
  router.post('/', async (req: Request, res: Response) => {
    const errors = validateProviderBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }
    try {
      const body = req.body as Record<string, unknown>;
      const now = new Date().toISOString();
      const provider: Provider = {
        id: uuidv4(),
        name: (body.name as string).trim(),
        description: (body.description as string | undefined) ?? '',
        provider: body.provider as ProviderConfig,
        thinking: body.thinking as Provider['thinking'],
        effort: body.effort as Provider['effort'],
        timeoutSeconds: typeof body.timeoutSeconds === 'number' ? body.timeoutSeconds : 300,
        createdAt: now,
        updatedAt: now,
      };
      await storage.saveProvider(provider);
      res.status(201).json(maskProvider(provider));
    } catch (err) {
      logger.error('Failed to create provider', { error: String(err) });
      res.status(500).json({ error: 'Failed to create provider' });
    }
  });

  // PUT /:id — update provider
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const existing = await storage.getProvider(id);
      if (!existing) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }
      const errors = validateProviderBody(req.body);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }
      const body = req.body as Record<string, unknown>;
      const updated: Provider = {
        id: existing.id,
        createdAt: existing.createdAt,
        name: (body.name as string).trim(),
        description: (body.description as string | undefined) ?? '',
        provider: body.provider as ProviderConfig,
        thinking: body.thinking as Provider['thinking'],
        effort: body.effort as Provider['effort'],
        timeoutSeconds: typeof body.timeoutSeconds === 'number' ? body.timeoutSeconds : 300,
        updatedAt: new Date().toISOString(),
      };
      await storage.saveProvider(updated);
      res.json(maskProvider(updated));
    } catch (err) {
      logger.error('Failed to update provider', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to update provider' });
    }
  });

  // DELETE /:id — delete provider
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = paramId(req);
      const deleted = await storage.deleteProvider(id);
      if (!deleted) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      logger.error('Failed to delete provider', { id: paramId(req), error: String(err) });
      res.status(500).json({ error: 'Failed to delete provider' });
    }
  });

  return router;
}
