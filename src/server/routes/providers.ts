import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Request, Response } from 'express';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import type { Provider } from '../types/index.js';

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
  return { ...provider, apiKey: maskSecret(provider.apiKey) };
}

function maskProviderMetadata(provider: Provider): Record<string, unknown> {
  return {
    id: provider.id,
    name: provider.name,
    providerName: provider.providerName,
    model: provider.model,
    createdAt: provider.createdAt,
  };
}

interface ValidationError {
  readonly field: string;
  readonly message: string;
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
  if (typeof b.providerName !== 'string' || b.providerName.trim().length === 0) {
    errors.push({ field: 'providerName', message: 'providerName is required' });
  }
  if (typeof b.model !== 'string' || b.model.trim().length === 0) {
    errors.push({ field: 'model', message: 'model is required' });
  }
  if (typeof b.apiKey !== 'string' || b.apiKey.trim().length === 0) {
    errors.push({ field: 'apiKey', message: 'apiKey is required' });
  }
  if (b.timeoutSeconds !== undefined) {
    if (typeof b.timeoutSeconds !== 'number' || b.timeoutSeconds <= 0) {
      errors.push({ field: 'timeoutSeconds', message: 'timeoutSeconds must be a positive number' });
    }
  }
  if (b.temperature !== undefined && (typeof b.temperature !== 'number' || b.temperature < 0 || b.temperature > 2)) {
    errors.push({ field: 'temperature', message: 'temperature must be a number between 0 and 2' });
  }
  if (b.maxTokens !== undefined && (typeof b.maxTokens !== 'number' || b.maxTokens <= 0)) {
    errors.push({ field: 'maxTokens', message: 'maxTokens must be a positive number' });
  }
  if (b.topP !== undefined && (typeof b.topP !== 'number' || b.topP < 0 || b.topP > 1)) {
    errors.push({ field: 'topP', message: 'topP must be a number between 0 and 1' });
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
        providerName: (body.providerName as string).trim(),
        model: (body.model as string).trim(),
        apiKey: body.apiKey as string,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
        temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
        maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
        topP: typeof body.topP === 'number' ? body.topP : undefined,
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
        providerName: (body.providerName as string).trim(),
        model: (body.model as string).trim(),
        apiKey: body.apiKey as string,
        baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl : undefined,
        temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
        maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : undefined,
        topP: typeof body.topP === 'number' ? body.topP : undefined,
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
