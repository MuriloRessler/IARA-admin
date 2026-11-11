import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { detectRasterLines } from '../src/services/image-processing.js';
import { recognizeCell } from '../src/services/local-extraction-provider.js';
import { parseCellText } from '../src/services/ocr-engine.js';
import { detectClassHeaders, detectPageStructure } from '../src/services/table-detector.js';

const textItems = [
  { text: 'INFO 61 1', x: 40, y: 30, width: 70, height: 10 },
  ...['SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA'].map((text, index) => ({ text, x: 120 + index * 80, y: 80, width: 45, height: 10 })),
  { text: '08:20', x: 20, y: 150, width: 35, height: 10 },
  { text: '09:10', x: 20, y: 250, width: 35, height: 10 },
];

test('table detector identifies catalog class headers without assuming half-page columns', () => {
  const headers = detectClassHeaders({ textItems, classes: ['61 1', '61 2'] });
  assert.equal(headers.length, 1);
  assert.equal(headers[0].classCode, '61 1');
});

test('cell parser separates an explicit teacher and preserves uncertainty', () => {
  assert.deepEqual(parseCellText('Programação (Rodrigo) Sala A1'), {
    disciplina: 'Programação', professor: 'Rodrigo', sala: 'A1', estado: 'reconhecido', incertezas: [],
  });
  assert.equal(parseCellText('Programação').estado, 'parcial');
});

test('structure detector creates independent cells from detected rows and day columns', async () => {
  const imageBuffer = await sharp({ create: { width: 600, height: 800, channels: 3, background: 'white' } }).png().toBuffer();
  const result = await detectPageStructure({
    page: { pageNumber: 1, width: 600, height: 800, renderWidth: 600, renderHeight: 800, textItems, imageBuffer },
    course: { name: 'Informática', classes: ['61 1', '61 2'] },
  });
  assert.equal(result.tables[0].classCode, '61 1');
  assert.equal(result.tables[0].cells.length, 10);
});

test('pixel detector identifies tolerant horizontal and vertical table lines', async () => {
  const svg = Buffer.from('<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="20" width="200" height="4" fill="black" /><rect x="0" y="100" width="200" height="4" fill="black" /><rect x="20" y="0" width="4" height="200" fill="black" /><rect x="100" y="0" width="4" height="200" fill="black" /></svg>');
  const lines = await detectRasterLines(await sharp(svg).png().toBuffer(), { threshold: 0.7 });
  assert.ok(lines.horizontal.some((line) => Math.abs(line - 100) <= 2));
  assert.ok(lines.vertical.some((line) => Math.abs(line - 100) <= 2));
});

test('calibration keeps relative table and row geometry independent of page pixels', async () => {
  const imageBuffer = await sharp({ create: { width: 600, height: 800, channels: 3, background: 'white' } }).png().toBuffer();
  const result = await detectPageStructure({
    page: { pageNumber: 1, width: 600, height: 800, renderWidth: 600, renderHeight: 800, textItems, imageBuffer },
    course: { name: 'Informática', classes: ['61 1', '61 2'] },
    calibration: { pages: [{ pageNumber: 1, tables: [{ classCode: '61 1', relative: true, bbox: { left: 0.2, width: 0.5 }, rows: [{ posicao: 1, inicio: '07:30', top: 0.1, bottom: 0.2 }, { posicao: 2, inicio: '08:20', top: 0.2, bottom: 0.3 }] }] }] },
  });
  assert.equal(result.tables[0].bbox.left, 120);
  assert.equal(result.tables[0].bbox.width, 300);
  assert.equal(result.tables[0].rows[0].top, 80);
  assert.equal(result.tables[0].rows[1].bottom, 240);
});

test('OCR failures keep detected cells available for human review', async () => {
  const imageBuffer = await sharp({ create: { width: 100, height: 100, channels: 3, background: 'black' } }).png().toBuffer();
  let calls = 0;
  const result = await recognizeCell({
    page: { pageNumber: 1, width: 100, height: 100, renderWidth: 100, renderHeight: 100, imageBuffer },
    cell: { day: 'segunda', posicao: 1, inicio: '07:30', bbox: { left: 0, top: 0, width: 100, height: 100 }, textoDigital: '' },
    ocrEngine: { recognize: async () => { calls += 1; throw new Error('mock OCR failure'); } },
  });
  assert.equal(calls, 1);
  assert.equal(result.estado, 'nao_reconhecido');
  assert.equal(result.posicao, 1);
});
