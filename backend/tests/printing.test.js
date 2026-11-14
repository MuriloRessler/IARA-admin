import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createPrintingRepository } from '../src/services/printing-repository.js';

const id = '12345678-1234-1234-1234-123456789abc';
const setup = (userId = 'admin') => {
  const calls = [];
  const app = createApp({ config: { allowedOrigins: [], adminUserId: 'admin' },
    supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: userId } } }) } },
    printingRepository: {
      list: async (filter) => { calls.push(filter); return { records: [], total: 0 }; },
      download: async (value) => { calls.push(value); return { url: 'https://example.test/file' }; },
      markPrinted: async (value) => { calls.push(value); return { id: value, impresso: true }; },
    },
  });
  return { app, calls };
};
test('all printing routes require authentication and admin authorization', async () => {
  for (const [method, path] of [['get', '/'], ['post', `/${id}/download`], ['patch', `/${id}/printed`]]) {
    const { app, calls } = setup();
    assert.equal((await request(app)[method](`/api/printings${path}`)).status, 401);
    assert.equal((await request(setup('other').app)[method](`/api/printings${path}`).set('Authorization', 'Bearer token')).status, 403);
    assert.equal(calls.length, 0);
  }
});
test('printing filters, UUID and explicit confirmation are validated before operations', async () => {
  const { app, calls } = setup();
  const api = (method, path) => request(app)[method](`/api/printings${path}`).set('Authorization', 'Bearer token');
  assert.equal((await api('get', '/?status=invalid')).status, 400);
  assert.equal((await api('get', '/?page=0')).status, 400);
  assert.equal((await api('post', '/invalid/download')).status, 400);
  assert.equal((await api('patch', `/${id}/printed`).send({ confirmed: false })).status, 400);
  assert.equal(calls.length, 0);
  const response = await api('get', '/?status=printed&page=2');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(calls.pop(), { printed: true, page: 2 });
  assert.equal((await api('patch', `/${id}/printed`).send({ confirmed: true })).body.impresso, true);
});

function mockClient(results) {
  const calls = [];
  const client = { schema(name) { calls.push(['schema', name]); return this; }, from(name) {
    calls.push(['from', name]);
    const result = results.shift();
    const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) };
    for (const method of ['select', 'eq', 'limit', 'order', 'range', 'update', 'maybeSingle']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
    return query;
  } };
  return { client, calls };
}
test('repository checks required schema, paginates confirmed requests and tolerates absent metadata', async () => {
  const { client, calls } = mockClient([{ data: [] }, { data: [{ id, nome: null, impresso: false, impressao: 'file.pdf' }], count: 1 }]);
  const result = await createPrintingRepository({ client }).list({ printed: false, page: 2 });
  assert.equal(result.records[0].nome_arquivo, null);
  assert.equal(result.records[0].hasFile, true);
  assert.equal('impressao' in result.records[0], false);
  assert.ok(calls.some((call) => JSON.stringify(call) === JSON.stringify(['range', 25, 49])));
  assert.ok(calls.filter(([method]) => method === 'from').every(([, name]) => name === 'impressoes'));
  const missing = mockClient([{ error: { code: '42703' } }]);
  await assert.rejects(createPrintingRepository({ client: missing.client }).list({ printed: false, page: 1 }), { code: 'PRINTING_SCHEMA_MISSING' });
});
test('marking changes only impresso and is idempotent', async () => {
  const { client, calls } = mockClient([{ data: [] }, { data: { id, impresso: true } }]);
  assert.deepEqual(await createPrintingRepository({ client }).markPrinted(id), { id, impresso: true });
  assert.deepEqual(calls.find(([method]) => method === 'update'), ['update', { impresso: true }]);
});
test('download signs only a stored relative path in the configured bucket', async () => {
  const { client } = mockClient([{ data: { impressao: 'documents/folder/file.pdf' } }]);
  client.storage = { from(bucket) { assert.equal(bucket, 'documents'); return { createSignedUrl: async (path, ttl, options) => {
    assert.equal(path, 'folder/file.pdf'); assert.equal(ttl, 60); assert.equal(options.download, 'file.pdf');
    return { data: { signedUrl: 'https://example.test/signed' } };
  } }; } };
  assert.equal((await createPrintingRepository({ client, config: { printingStorageBucket: 'documents' } }).download(id)).expiresIn, 60);
  for (const path of ['https://evil.test/file', '../file', '/file', 'folder\\file']) {
    const invalid = mockClient([{ data: { impressao: path } }]);
    await assert.rejects(createPrintingRepository({ client: invalid.client, config: { printingStorageBucket: 'documents' } }).download(id), { code: 'PRINTING_FILE_PATH_INVALID' });
  }
});
