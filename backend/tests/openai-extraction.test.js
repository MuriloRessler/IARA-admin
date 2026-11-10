import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpenAiExtractionProvider } from '../src/services/openai-extraction-provider.js';

test('OpenAI provider sends the PDF as a non-persistent structured Responses request', async () => {
  let requestBody;
  const provider = createOpenAiExtractionProvider({
    config: { openaiApiKey: 'test-key', openaiModel: 'gpt-4.1-mini', extractionTimeoutMs: 1000 },
    client: { responses: { create: async (body) => { requestBody = body; return { output_text: '{"paginasAnalisadas":1,"turmas":[],"observacoes":[]}' }; } } },
  });
  const result = await provider.extract({ buffer: Buffer.from('%PDF-test'), fileName: 'horarios.pdf', course: { name: 'Informática', classes: ['61 1'] }, pageCount: 1 });

  assert.deepEqual(result, { paginasAnalisadas: 1, turmas: [], observacoes: [] });
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.model, 'gpt-4.1-mini');
  assert.equal(requestBody.input[0].content[0].type, 'input_file');
  assert.match(requestBody.input[0].content[0].file_data, /^data:application\/pdf;base64,/);
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.strict, true);
  assert.ok(requestBody.text.format.schema.properties.turmas.items.properties.segunda.properties.posicoes);
});
