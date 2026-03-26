import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createProviderRoutes } from './providers.js';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import { BASE_PROVIDER, makeProvider, createMockStorage, createMockLogger } from './route-test-helpers.js';

function createApp(storage: IStorage, logger: ILogger): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/providers', createProviderRoutes(storage, logger));
  return app;
}

const VALID_BODY = {
  name: 'My Provider',
  description: 'desc',
  provider: BASE_PROVIDER,
  timeoutSeconds: 300,
};

describe('Provider routes', () => {
  let storage: IStorage;
  let logger: ILogger;
  let app: express.Express;

  beforeEach(() => {
    storage = createMockStorage();
    logger = createMockLogger();
    app = createApp(storage, logger);
  });

  describe('GET /api/providers', () => {
    it('returns metadata list of all providers', async () => {
      vi.mocked(storage.listProviders).mockResolvedValue([makeProvider()]);
      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([{
        id: 'provider-1',
        name: 'Test Provider',
        providerType: 'api',
        model: 'claude-sonnet-4-6',
        createdAt: '2026-01-01T00:00:00.000Z',
      }]);
    });

    it('returns empty array when no providers exist', async () => {
      vi.mocked(storage.listProviders).mockResolvedValue([]);
      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.listProviders).mockRejectedValue(new Error('disk fail'));
      const res = await request(app).get('/api/providers');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to list providers');
    });
  });

  describe('GET /api/providers/:id', () => {
    it('returns full provider with masked API key', async () => {
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());
      const res = await request(app).get('/api/providers/provider-1');
      expect(res.status).toBe(200);
      expect(res.body.provider.apiKey).toBe('****1234');
      expect(res.body.name).toBe('Test Provider');
    });

    it('masks oauth token for oauth providers', async () => {
      const oauthProvider = makeProvider({
        provider: { kind: 'oauth', oauthToken: 'not-real-abcd', model: 'claude-sonnet-4-6' },
      });
      vi.mocked(storage.getProvider).mockResolvedValue(oauthProvider);
      const res = await request(app).get('/api/providers/provider-1');
      expect(res.status).toBe(200);
      expect(res.body.provider.oauthToken).toBe('****abcd');
    });

    it('masks short secrets correctly', async () => {
      const provider = makeProvider({ provider: { ...BASE_PROVIDER, apiKey: 'ab' } });
      vi.mocked(storage.getProvider).mockResolvedValue(provider);
      const res = await request(app).get('/api/providers/provider-1');
      expect(res.body.provider.apiKey).toBe('****');
    });

    it('returns 404 for non-existent provider', async () => {
      vi.mocked(storage.getProvider).mockResolvedValue(undefined);
      const res = await request(app).get('/api/providers/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Provider not found');
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.getProvider).mockRejectedValue(new Error('disk fail'));
      const res = await request(app).get('/api/providers/provider-1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/providers', () => {
    it('creates a provider and returns it with masked key', async () => {
      vi.mocked(storage.saveProvider).mockResolvedValue(undefined);
      const res = await request(app).post('/api/providers').send(VALID_BODY);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Provider');
      expect(res.body.provider.apiKey).toBe('****1234');
      expect(res.body.id).toBeDefined();
      expect(storage.saveProvider).toHaveBeenCalledTimes(1);
    });

    it('rejects missing name', async () => {
      const res = await request(app).post('/api/providers').send({ ...VALID_BODY, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
      );
    });

    it('rejects missing provider', async () => {
      const res = await request(app).post('/api/providers').send({ name: 'Test', timeoutSeconds: 300 });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'provider' })]),
      );
    });

    it('rejects invalid provider kind', async () => {
      const res = await request(app).post('/api/providers').send({
        ...VALID_BODY, provider: { kind: 'invalid', model: 'x' },
      });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'provider.kind' })]),
      );
    });

    it('rejects api provider without apiKey', async () => {
      const res = await request(app).post('/api/providers').send({
        ...VALID_BODY, provider: { kind: 'api', baseUrl: 'http://example.com', model: 'x' },
      });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'provider.apiKey' })]),
      );
    });

    it('rejects oauth provider without token', async () => {
      const res = await request(app).post('/api/providers').send({
        ...VALID_BODY, provider: { kind: 'oauth', model: 'x' },
      });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'provider.oauthToken' })]),
      );
    });

    it('rejects negative timeoutSeconds', async () => {
      const res = await request(app).post('/api/providers').send({ ...VALID_BODY, timeoutSeconds: -5 });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'timeoutSeconds' })]),
      );
    });

    it('rejects zero timeoutSeconds', async () => {
      const res = await request(app).post('/api/providers').send({ ...VALID_BODY, timeoutSeconds: 0 });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'timeoutSeconds' })]),
      );
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.saveProvider).mockRejectedValue(new Error('write fail'));
      const res = await request(app).post('/api/providers').send(VALID_BODY);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/providers/:id', () => {
    it('updates an existing provider', async () => {
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());
      vi.mocked(storage.saveProvider).mockResolvedValue(undefined);
      const res = await request(app).put('/api/providers/provider-1').send({
        ...VALID_BODY, name: 'Updated Name',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.id).toBe('provider-1');
    });

    it('returns 404 for non-existent provider', async () => {
      vi.mocked(storage.getProvider).mockResolvedValue(undefined);
      const res = await request(app).put('/api/providers/nonexistent').send(VALID_BODY);
      expect(res.status).toBe(404);
    });

    it('validates body on update', async () => {
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());
      const res = await request(app).put('/api/providers/provider-1').send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.getProvider).mockResolvedValue(makeProvider());
      vi.mocked(storage.saveProvider).mockRejectedValue(new Error('fail'));
      const res = await request(app).put('/api/providers/provider-1').send(VALID_BODY);
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/providers/:id', () => {
    it('deletes an existing provider', async () => {
      vi.mocked(storage.deleteProvider).mockResolvedValue(true);
      const res = await request(app).delete('/api/providers/provider-1');
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent provider', async () => {
      vi.mocked(storage.deleteProvider).mockResolvedValue(false);
      const res = await request(app).delete('/api/providers/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.deleteProvider).mockRejectedValue(new Error('fail'));
      const res = await request(app).delete('/api/providers/provider-1');
      expect(res.status).toBe(500);
    });
  });
});
