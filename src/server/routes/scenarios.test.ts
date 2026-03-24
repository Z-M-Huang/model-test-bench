import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createScenarioRoutes } from './scenarios.js';
import type { IStorage } from '../interfaces/storage.js';
import type { ILogger } from '../interfaces/logger.js';
import { makeScenario, createMockStorage, createMockLogger } from './route-test-helpers.js';

function createApp(storage: IStorage, logger: ILogger): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/scenarios', createScenarioRoutes(storage, logger));
  return app;
}

const VALID_BODY = {
  name: 'My Scenario',
  prompt: 'Write a function that adds two numbers',
  category: 'planning',
};

describe('Scenario routes', () => {
  let storage: IStorage;
  let logger: ILogger;
  let app: express.Express;

  beforeEach(() => {
    storage = createMockStorage();
    logger = createMockLogger();
    app = createApp(storage, logger);
  });

  describe('GET /api/scenarios', () => {
    it('returns metadata list of all scenarios', async () => {
      vi.mocked(storage.listScenarios).mockResolvedValue([
        makeScenario(),
        makeScenario({ id: 'sc-2', name: 'Built-in', builtIn: true }),
      ]);
      const res = await request(app).get('/api/scenarios');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toEqual({
        id: 'scenario-1', name: 'Test Scenario',
        category: 'planning', builtIn: false, createdAt: '2026-01-01T00:00:00.000Z',
      });
      expect(res.body[0].prompt).toBeUndefined();
    });

    it('returns empty array when no scenarios exist', async () => {
      vi.mocked(storage.listScenarios).mockResolvedValue([]);
      const res = await request(app).get('/api/scenarios');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.listScenarios).mockRejectedValue(new Error('disk fail'));
      const res = await request(app).get('/api/scenarios');
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to list scenarios');
    });
  });

  describe('GET /api/scenarios/:id', () => {
    it('returns full scenario by ID', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(makeScenario());
      const res = await request(app).get('/api/scenarios/scenario-1');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('scenario-1');
      expect(res.body.prompt).toBe('Write a function');
    });

    it('returns 404 for non-existent scenario', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(undefined);
      const res = await request(app).get('/api/scenarios/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Scenario not found');
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.getScenario).mockRejectedValue(new Error('disk fail'));
      const res = await request(app).get('/api/scenarios/scenario-1');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /api/scenarios', () => {
    it('creates a custom scenario', async () => {
      vi.mocked(storage.saveScenario).mockResolvedValue(undefined);
      const res = await request(app).post('/api/scenarios').send(VALID_BODY);
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Scenario');
      expect(res.body.builtIn).toBe(false);
      expect(res.body.id).toBeDefined();
      expect(storage.saveScenario).toHaveBeenCalledTimes(1);
    });

    it('rejects missing name', async () => {
      const res = await request(app).post('/api/scenarios').send({ ...VALID_BODY, name: '' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'name' })]),
      );
    });

    it('rejects missing prompt', async () => {
      const res = await request(app).post('/api/scenarios').send({ ...VALID_BODY, prompt: '' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'prompt' })]),
      );
    });

    it('rejects invalid category', async () => {
      const res = await request(app).post('/api/scenarios').send({
        ...VALID_BODY, category: 'invalid-cat',
      });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'category' })]),
      );
    });

    it('rejects scoring dimensions that do not sum to 1.0', async () => {
      const res = await request(app).post('/api/scenarios').send({
        ...VALID_BODY,
        scoringDimensions: [
          { name: 'accuracy', weight: 0.5, description: 'Accuracy' },
          { name: 'style', weight: 0.3, description: 'Style' },
        ],
      });
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'scoringDimensions' })]),
      );
    });

    it('accepts scoring dimensions that sum to 1.0', async () => {
      vi.mocked(storage.saveScenario).mockResolvedValue(undefined);
      const res = await request(app).post('/api/scenarios').send({
        ...VALID_BODY,
        scoringDimensions: [
          { name: 'accuracy', weight: 0.7, description: 'Accuracy' },
          { name: 'style', weight: 0.3, description: 'Style' },
        ],
      });
      expect(res.status).toBe(201);
    });

    it('accepts empty scoring dimensions', async () => {
      vi.mocked(storage.saveScenario).mockResolvedValue(undefined);
      const res = await request(app).post('/api/scenarios').send({
        ...VALID_BODY, scoringDimensions: [],
      });
      expect(res.status).toBe(201);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.saveScenario).mockRejectedValue(new Error('write fail'));
      const res = await request(app).post('/api/scenarios').send(VALID_BODY);
      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/scenarios/:id', () => {
    it('updates a custom scenario', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(makeScenario());
      vi.mocked(storage.saveScenario).mockResolvedValue(undefined);
      const res = await request(app).put('/api/scenarios/scenario-1').send({
        ...VALID_BODY, name: 'Updated Name',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.id).toBe('scenario-1');
    });

    it('returns 404 for non-existent scenario', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(undefined);
      const res = await request(app).put('/api/scenarios/nonexistent').send(VALID_BODY);
      expect(res.status).toBe(404);
    });

    it('validates body on update', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(makeScenario());
      const res = await request(app).put('/api/scenarios/scenario-1').send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(makeScenario());
      vi.mocked(storage.saveScenario).mockRejectedValue(new Error('fail'));
      const res = await request(app).put('/api/scenarios/scenario-1').send(VALID_BODY);
      expect(res.status).toBe(500);
    });
  });

  describe('DELETE /api/scenarios/:id', () => {
    it('deletes a custom scenario', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(makeScenario());
      vi.mocked(storage.deleteScenario).mockResolvedValue(true);
      const res = await request(app).delete('/api/scenarios/scenario-1');
      expect(res.status).toBe(204);
    });

    it('returns 404 for non-existent scenario', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(undefined);
      const res = await request(app).delete('/api/scenarios/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns 500 on storage failure', async () => {
      vi.mocked(storage.getScenario).mockResolvedValue(makeScenario());
      vi.mocked(storage.deleteScenario).mockRejectedValue(new Error('fail'));
      const res = await request(app).delete('/api/scenarios/scenario-1');
      expect(res.status).toBe(500);
    });
  });
});
