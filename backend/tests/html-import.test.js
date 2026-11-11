import assert from 'node:assert/strict';
import test from 'node:test';
import iconv from 'iconv-lite';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { importHtmlSchedules, parseCellValue, parseScheduleHtml } from '../src/services/html-schedule-importer.js';

const config = {
  allowedOrigins: ['http://localhost:5173'],
  adminUserId: 'admin-user-id',
  htmlMaxSizeMb: 10,
};

const adminClient = { auth: { getUser: async () => ({ data: { user: { id: 'admin-user-id', email: 'admin@example.com' } }, error: null }) } };

const starts = ['07:30', '08:20', '09:10', '10:10', '11:00', '13:00', '13:50', '14:40', '15:40', '16:30'];
const days = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

const createHtml = () => `<!doctype html>
<html><head><meta charset="ISO-8859-1"><title>Turmas Geral</title></head><body>
<table><thead><tr><th>Dia</th><th>Início</th><th>INFO 63 2</th><th>DES 41 A</th><th>ELETRO 23A</th><th>Coordenação</th></tr></thead><tbody>
${days.map((day, dayIndex) => starts.map((start, position) => {
  const info = position === 0 || position === 1 ? 'Prática&nbsp;(Cleber Lino (LINO))' : position === 2 ? '-' : position === 3 ? 'Matemática (Professora)' : '-';
  const eletro = dayIndex === 0 && position === 0 ? 'Eletrônica (João)' : '-';
  return `<tr>${position === 0 ? `<td rowspan="10">${day}</td>` : ''}<td>${start}</td><td>${info}</td><td>-</td><td>${eletro}</td><td>Reunião</td></tr>`;
}).join('')).join('')}
</tbody></table></body></html>`;

const htmlBuffer = () => iconv.encode(createHtml(), 'iso-8859-1');

test('HTML parser decodes ISO-8859-1, expands rowspan and parses nested parentheses', () => {
  const parsed = parseScheduleHtml({ html: iconv.decode(htmlBuffer(), 'windows-1252'), fileName: 'Documento de Murilo Ressler.html' });
  assert.equal(parsed.headerColumns, 6);
  assert.equal(parsed.dataRows, 50);
  assert.deepEqual(parsed.dayCounts, { segunda: 10, terca: 10, quarta: 10, quinta: 10, sexta: 10 });
  const info = parsed.classes.find((item) => item.turma === '63 2');
  assert.equal(info.segunda.posicoes.length, 10);
  assert.equal(info.segunda.posicoes[0].disciplina, 'Prática');
  assert.equal(info.segunda.posicoes[0].professor, 'Cleber Lino (LINO)');
  assert.equal(info.segunda.posicoes[2].estado, 'vazio_documento');
  assert.equal(parsed.classes.find((item) => item.turma === '41A').segunda.posicoes.every((item) => item.estado === 'vazio_documento'), true);
  assert.equal(parsed.classes.find((item) => item.turma === '23A').segunda.posicoes[0].disciplina, 'Eletrônica');
});

test('cell parser preserves malformed content for human review', () => {
  const result = parseCellValue('Prática (Professor (A)');
  assert.equal(result.estado, 'parcial');
  assert.equal(result.disciplina, 'Prática (Professor (A)');
  assert.ok(result.incertezas.length > 0);
});

test('HTML import normalizes all recognized classes without grouping periods', () => {
  const result = importHtmlSchedules({ buffer: htmlBuffer(), fileName: 'horarios.html', mimeType: 'text/html', maxSizeMb: 10 });
  const info = result.schedules['Informática::63 2'];
  const design = result.schedules['Design de Móveis::41A'];
  assert.equal(result.status, 'ready_for_review');
  assert.equal(result.origem, 'html');
  assert.equal(info.origem, 'html');
  assert.equal(info.revisao, 'nao_revisado');
  assert.equal(info.dias.segunda.periodos.length, 10);
  assert.equal(info.dias.segunda.periodos[0].disciplina, 'Prática');
  assert.equal(info.dias.segunda.periodos[1].disciplina, 'Prática');
  assert.equal(info.dias.segunda.periodos.some((period) => Object.hasOwn(period, 'fim')), false);
  assert.equal(design.dias.segunda.situacao, 'pendente');
  assert.equal(design.dias.segunda.periodos.length, 10);
  assert.equal(result.diagnostico.diasPendentes > 0, true);
  assert.equal(result.diagnostico.turmasAusentes.length > 0, true);
});

test('POST /api/schedules/import-html requires admin authentication and returns structured schedules', async () => {
  const app = createApp({ config, supabaseClient: adminClient });
  const unauthorized = await request(app)
    .post('/api/schedules/import-html')
    .attach('file', htmlBuffer(), { filename: 'horarios.html', contentType: 'text/html' });
  assert.equal(unauthorized.statusCode, 401);

  const response = await request(app)
    .post('/api/schedules/import-html')
    .set('Authorization', 'Bearer valid-token')
    .attach('file', htmlBuffer(), { filename: 'horarios.html', contentType: 'text/html' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.diagnosticoEstrutural.motor, 'structured-html');
  assert.equal(response.body.schedules['Eletrotécnica::23A'].dias.segunda.periodos[0].disciplina, 'Eletrônica');
});

test('HTML import rejects files without the required structured header', () => {
  assert.throws(() => importHtmlSchedules({
    buffer: Buffer.from('<table><tr><td>not a schedule</td></tr></table>'),
    fileName: 'invalid.html',
    mimeType: 'text/html',
    maxSizeMb: 10,
  }), (error) => error.code === 'HTML_HEADER_INVALID');
});
