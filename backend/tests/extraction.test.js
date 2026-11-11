import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { PDFDocument } from 'pdf-lib';
import { createApp } from '../src/app.js';
import { courses } from '../src/config/courses.js';
import { ExtractionError } from '../src/services/extraction-errors.js';

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
    turmaAssociacao: { regiao: 'left', confianca: 'confiavel' },
    avisos: [],
    segunda: { situacaoDocumento: 'com_aulas', avisos: [], posicoes: [{ posicao: 1, posicoesAssociadas: [], estado: 'reconhecido', inicio: '07:30', disciplina: 'Matemática', professor: null, sala: null, pagina: 1, incertezas: [] }] },
    terca: { situacaoDocumento: 'dia_em_branco', avisos: [], posicoes: [] },
    quarta: { situacaoDocumento: 'nao_reconhecido', avisos: ['Tabela cortada.'], posicoes: [] },
    quinta: { situacaoDocumento: 'com_aulas', avisos: [], posicoes: [] },
    sexta: { situacaoDocumento: 'com_aulas', avisos: [], posicoes: [] },
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
    .field('course', courses[0].name)
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

test('POST /api/schedules/extract uses the local extractor by default', async () => {
  const pdf = await createPdf();
  const response = await request(createApp({
    config: { ...config, openaiApiKey: '', extractionEngine: 'local' },
    supabaseClient: { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id' } }, error: null }) } },
  }))
    .post('/api/schedules/extract')
    .set('Authorization', 'Bearer valid-token')
    .field('course', 'Informática')
    .attach('file', pdf, { filename: 'horarios.pdf', contentType: 'application/pdf' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.diagnosticoEstrutural.motor, 'local-structure-ocr');
});

test('POST /api/schedules/cell-preview returns a temporary cell image', async () => {
  const pdf = await createPdf();
  const response = await request(createExtractionApp({ extract: async () => extracted }))
    .post('/api/schedules/cell-preview')
    .set('Authorization', 'Bearer valid-token')
    .field('page', '1')
    .field('bbox', JSON.stringify({ left: 0, top: 0, width: 100, height: 100 }))
    .attach('file', pdf, { filename: 'horarios.pdf', contentType: 'application/pdf' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'].startsWith('image/png'), true);
  assert.ok(response.body.length > 0);
});

test('a recoverable extraction error returns an API response and does not stop health checks', async () => {
  const app = createExtractionApp({ extract: async () => { throw new ExtractionError('OCR_UNAVAILABLE', 'OCR unavailable', 503); } });
  const pdf = await createPdf();
  const extractionResponse = await request(app)
    .post('/api/schedules/extract')
    .set('Authorization', 'Bearer valid-token')
    .field('course', courses[0].name)
    .attach('file', pdf, { filename: 'horarios.pdf', contentType: 'application/pdf' });

  assert.equal(extractionResponse.statusCode, 503);
  assert.equal(extractionResponse.body.error.code, 'OCR_UNAVAILABLE');
  const healthResponse = await request(app).get('/api/health');
  assert.equal(healthResponse.statusCode, 200);
});
