import OpenAI from 'openai';
import { extractionFormat } from './extraction-schema.js';
import { createExtractionPrompt } from './extraction-prompt.js';
import { ExtractionError } from './extraction-errors.js';

export const createOpenAiExtractionProvider = ({ config, client } = {}) => ({
  async extract({ buffer, fileName, course, pageCount }) {
    if (!config?.openaiApiKey) throw new ExtractionError('EXTRACTION_NOT_CONFIGURED', 'A extração automática ainda não foi configurada no backend.', 503);
    const openai = client || new OpenAI({ apiKey: config.openaiApiKey, maxRetries: 0, timeout: config.extractionTimeoutMs });
    try {
      const response = await openai.responses.create({
        model: config.openaiModel,
        store: false,
        input: [{ role: 'user', content: [
          { type: 'input_file', filename: fileName, file_data: `data:application/pdf;base64,${buffer.toString('base64')}`, detail: 'high' },
          { type: 'input_text', text: createExtractionPrompt({ course, pageCount }) },
        ] }],
        text: { format: extractionFormat },
      });
      if (!response.output_text) throw new ExtractionError('EXTRACTION_EMPTY', 'O modelo não retornou dados estruturados.', 422);
      try {
        return JSON.parse(response.output_text);
      } catch {
        throw new ExtractionError('EXTRACTION_INVALID_OUTPUT', 'A resposta do modelo não pôde ser validada.', 422);
      }
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      if (error?.name === 'APIUserAbortError' || error?.name === 'APITimeoutError') throw new ExtractionError('EXTRACTION_TIMEOUT', 'A extração excedeu o tempo limite.', 504);
      if (error?.status === 429) throw new ExtractionError('EXTRACTION_RATE_LIMITED', 'O serviço de extração está temporariamente limitado. Tente novamente.', 429);
      if (error?.status >= 500) throw new ExtractionError('EXTRACTION_PROVIDER_UNAVAILABLE', 'O serviço de extração está indisponível no momento.', 503);
      throw new ExtractionError('EXTRACTION_PROVIDER_ERROR', 'Não foi possível concluir a extração automática.', 502);
    }
  },
});
