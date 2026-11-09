import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { app } from '../src/app.js';

test('GET /api/health returns the backend status', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    status: 'ok',
    service: 'iara-admin-backend',
  });
});

test('unknown API routes return JSON 404 responses', async () => {
  const response = await request(app).get('/api/unknown');

  assert.equal(response.statusCode, 404);
  assert.equal(response.body.error, 'Route not found');
});
