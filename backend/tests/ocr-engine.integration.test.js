import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { createOcrEngine } from '../src/services/ocr-engine.js';

const createTestImage = () => sharp(Buffer.from('<svg width="700" height="160" xmlns="http://www.w3.org/2000/svg"><rect width="700" height="160" fill="white"/><text x="20" y="100" font-family="Arial" font-size="54" fill="black">Programacao</text></svg>')).png().toBuffer();

test('OCR reports an initialization error when its cache path is not writable', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'iara-ocr-'));
  const cacheFile = path.join(temporaryDirectory, 'cache-file');
  await writeFile(cacheFile, 'not a directory');
  const engine = createOcrEngine({ language: 'por+eng', cachePath: cacheFile });
  try {
    const image = await createTestImage();
    await assert.rejects(() => engine.recognize(image), (error) => error.code === 'OCR_UNAVAILABLE' && error.statusCode === 503);
  } finally {
    await engine.close();
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('real Tesseract.js worker recognizes a simple image with Portuguese and English enabled', { skip: process.env.RUN_REAL_OCR !== '1' }, async () => {
  const cachePath = process.env.OCR_CACHE_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cache/ocr');
  const engine = createOcrEngine({ language: 'por+eng', cachePath, logger: true, errorHandler: {} });
  try {
    const result = await engine.recognize(await createTestImage());
    assert.ok(result.textoOriginal.trim());
  } finally {
    await engine.close();
  }
});
