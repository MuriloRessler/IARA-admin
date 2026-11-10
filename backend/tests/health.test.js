import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { app, createApp } from '../src/app.js';

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

const config = {
  allowedOrigins: ['http://localhost:5173'],
  adminUserId: 'admin-user-id',
};

const createAuthApp = (getUser, adminUserId = 'admin-user-id') => createApp({
  config: { ...config, adminUserId },
  supabaseClient: { auth: { getUser } },
});

test('GET /api/auth/me requires a bearer token', async () => {
  const response = await request(createAuthApp(async () => ({ data: {}, error: null })))
    .get('/api/auth/me');

  assert.equal(response.statusCode, 401);
});

test('GET /api/auth/me rejects invalid tokens', async () => {
  const response = await request(createAuthApp(async () => ({
    data: { user: null },
    error: { status: 401 },
  }))).get('/api/auth/me').set('Authorization', 'Bearer invalid-token');

  assert.equal(response.statusCode, 401);
});

test('GET /api/auth/me rejects authenticated users without admin authorization', async () => {
  const response = await request(createAuthApp(async () => ({
    data: { user: { id: 'different-user-id', email: 'other@example.com' } },
    error: null,
  }))).get('/api/auth/me').set('Authorization', 'Bearer valid-token');

  assert.equal(response.statusCode, 403);
});

test('GET /api/auth/me returns minimal admin information for the authorized user', async () => {
  const response = await request(createAuthApp(async () => ({
    data: { user: { id: 'admin-user-id', email: 'admin@example.com', user_metadata: { secret: true } } },
    error: null,
  }))).get('/api/auth/me').set('Authorization', 'Bearer valid-token');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    id: 'admin-user-id',
    email: 'admin@example.com',
    role: 'admin',
  });
});

test('GET /api/auth/me fails safely when administrative configuration is missing', async () => {
  const response = await request(createAuthApp(async () => ({ data: {}, error: null }), ''))
    .get('/api/auth/me').set('Authorization', 'Bearer valid-token');

  assert.equal(response.statusCode, 503);
});

test('GET /api/auth/me returns 503 when Supabase is temporarily unavailable', async () => {
  const response = await request(createAuthApp(async () => {
    throw new Error('temporary failure');
  })).get('/api/auth/me').set('Authorization', 'Bearer valid-token');

  assert.equal(response.statusCode, 503);
});
