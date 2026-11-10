import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { createApp } from '../src/app.js';

const config = {
  allowedOrigins: ['http://localhost:5173'],
  adminUserId: 'admin-user-id',
  pdfMaxSizeMb: 20,
  pdfMaxPages: 30,
  extractionTimeoutMs: 1000,
};

const extracted = {
  paginasAnalisadas: 1,
  observacoes: ['Confira a leitura antes de revisar.'],
  turmas: [{
    turma: '61 1',
    curso: 'Informática',
    avisos: [],
    segunda: { situacaoDocumento: 'com_aulas', avisos: [], periodos: [{ inicio: '07:30', fim: '08:20', disciplina: 'Matemática', professor: null, sala: null, pagina: 1, incertezas: [] }] },
    terca: { situacaoDocumento: 'dia_em_branco', avisos: [], periodos: [] },
    quarta: { situacaoDocumento: 'nao_reconhecido', avisos: ['Tabela cortada.'], periodos: [] },
    quinta: { situacaoDocumento: 'com_aulas', avisos: [], periodos: [] },
    sexta: { situacaoDocumento: 'com_aulas', avisos: [], periodos: [] },
  }],
};

const createPdf = async () => {
  const document = await PDFDocument.create();
  document.addPage();
  return Buffer.from(await document.save());
};

const createExtractionApp = (extractionProvider) => createApp({
  config,
  supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@example.com' } }, error: null }) } },
  extractionProvider,
});

test('POST /api/schedules/extract validates the PDF and normalizes extracted schedules', async () => {
  const pdf = await createPdf();
  const response = await request(createExtractionApp({ extract: async () => extracted }))
    .post('/api/schedules/extract')
    .set('Authorization', 'Bearer valid-token')
    .field('course', 'Informática')
    .attach('file', pdf, { filename: 'horarios.pdf', contentType: 'application/pdf' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, 'ready_for_review');
  assert.equal(response.body.classes[0], '61 1');
  assert.equal(response.body.schedules['Informática::61 1'].revisao, 'nao_revisado');
  assert.equal(response.body.schedules['Informática::61 1'].dias.terca.situacao, 'pendente');
});

test('POST /api/schedules/extract rejects invalid PDF signatures', async () => {
  const response = await request(createExtractionApp({ extract: async () => extracted }))
    .post('/api/schedules/extract')
    .set('Authorization', 'Bearer valid-token')
    .field('course', 'Informática')
    .attach('file', Buffer.from('not a pdf'), { filename: 'horarios.pdf', contentType: 'application/pdf' });

  assert.equal(response.statusCode, 415);
  assert.equal(response.body.error.code, 'PDF_SIGNATURE_INVALID');
});

test('POST /api/schedules/extract returns 503 when OpenAI is not configured', async () => {
  const pdf = await createPdf();
  const response = await request(createApp({
    config: { ...config, openaiApiKey: '' },
    supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id' } }, error: null }) } },
  }))
    .post('/api/schedules/extract')
    .set('Authorization', 'Bearer valid-token')
    .field('course', 'Informática')
    .attach('file', pdf, { filename: 'horarios.pdf', contentType: 'application/pdf' });

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.error.code, 'EXTRACTION_NOT_CONFIGURED');
});
