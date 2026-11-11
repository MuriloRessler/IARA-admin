import { createWorker } from 'tesseract.js';

export const parseCellText = (text) => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return { disciplina: '', professor: '', sala: '', estado: 'nao_reconhecido', incertezas: ['OCR não encontrou texto.'] };
  const salaMatch = normalized.match(/\b(?:sala|sl\.?)[\s:.-]*([A-Z0-9-]+)/i);
  const withoutRoom = salaMatch ? normalized.replace(salaMatch[0], '').trim() : normalized;
  const teacherMatch = withoutRoom.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (teacherMatch) return { disciplina: teacherMatch[1].trim(), professor: teacherMatch[2].trim(), sala: salaMatch?.[1] || '', estado: 'reconhecido', incertezas: [] };
  return { disciplina: withoutRoom, professor: '', sala: salaMatch?.[1] || '', estado: 'parcial', incertezas: ['Professor não foi separado com segurança.'] };
};

export const createOcrEngine = ({ language = 'por+eng', cachePath, logger } = {}) => {
  let workerPromise;
  const getWorker = () => {
    workerPromise ||= createWorker(language, 1, { cachePath, logger });
    return workerPromise;
  };
  return {
    async recognize(buffer) {
      const worker = await getWorker();
      const result = await worker.recognize(buffer);
      return { ...parseCellText(result.data?.text || ''), textoOriginal: result.data?.text || '' };
    },
    async close() {
      if (workerPromise) (await workerPromise).terminate();
      workerPromise = null;
    },
  };
};
