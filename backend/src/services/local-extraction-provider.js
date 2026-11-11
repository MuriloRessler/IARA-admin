import { getLayoutProfile } from '../../../shared/layout-profiles.js';
import { cropImage, imageStats } from './image-processing.js';
import { createOcrEngine, parseCellText } from './ocr-engine.js';
import { inspectPdf } from './pdf-renderer.js';
import { detectPageStructure } from './table-detector.js';

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
const emptyDay = (message) => ({ situacaoDocumento: 'nao_reconhecido', posicoes: [], avisos: [message] });

const cellBoxInPixels = (page, bbox) => ({
  left: bbox.left * (page.renderWidth / page.width),
  top: bbox.top * (page.renderHeight / page.height),
  width: bbox.width * (page.renderWidth / page.width),
  height: bbox.height * (page.renderHeight / page.height),
});

export const recognizeCell = async ({ page, cell, ocrEngine }) => {
  const image = await cropImage(page.imageBuffer, cellBoxInPixels(page, cell.bbox));
  const stats = await imageStats(image);
  const source = {
    pagina: page.pageNumber,
    bbox: cell.bbox,
    imagemDisponivel: true,
  };
  if (stats.inkRatio < 0.006 && !cell.textoDigital) {
    return { ...cell, ...source, estado: 'vazio_documento', disciplina: '', professor: '', sala: '', incertezas: [] };
  }
  if (cell.textoDigital) return { ...cell, ...source, ...parseCellText(cell.textoDigital) };
  try {
    return { ...cell, ...source, ...(await ocrEngine.recognize(image)) };
  } catch (error) {
    if (error.isOcrInitialization) throw error;
    return { ...cell, ...source, estado: 'nao_reconhecido', disciplina: '', professor: '', sala: '', incertezas: [`OCR indisponível para esta célula: ${error.message}`] };
  }
};

export const createLocalExtractionProvider = ({ config, ocrEngine } = {}) => ({
  async extract({ buffer, course, pageCount, calibration }) {
    const pagesResult = await inspectPdf(buffer, { maxPages: pageCount, renderScale: config?.pdfRenderScale || 1.5 });
    const profile = getLayoutProfile(course.name);
    const engine = ocrEngine || createOcrEngine({ language: config?.ocrLanguages || 'por+eng', cachePath: config?.ocrCachePath });
    const turmas = new Map();
    const pageDiagnostics = [];
    let cellsDetected = 0;
    let cellsRecognized = 0;
    let cellsEmpty = 0;
    let cellsUnrecognized = 0;
    try {
      for (const page of pagesResult.pages) {
        const structure = await detectPageStructure({ page, course, profile, calibration });
        pageDiagnostics.push({ page: page.pageNumber, width: page.width, height: page.height, textSelectable: structure.textSelectable, tables: structure.tables.map((table) => ({ classCode: table.classCode, confidence: table.confidence, cells: table.cells.length, bbox: table.bbox, rows: table.rows, warnings: table.warnings })), warnings: structure.warnings });
        for (const table of structure.tables) {
          const key = table.classCode;
          if (!key) continue;
          if (!turmas.has(key)) turmas.set(key, { turma: key, curso: course.name, turmaAssociacao: { regiao: `página ${page.pageNumber}`, confianca: table.confidence >= 0.72 ? 'confiavel' : 'duvidosa' }, avisos: [], days: Object.fromEntries(DAYS.map((day) => [day, { situacaoDocumento: 'nao_reconhecido', posicoes: [], avisos: [] }])) });
          const turma = turmas.get(key);
          for (const cell of table.cells) {
            cellsDetected += 1;
            const recognized = await recognizeCell({ page, cell, ocrEngine: engine });
            const position = {
              posicao: recognized.posicao,
              posicoesAssociadas: [],
              estado: recognized.estado || 'nao_reconhecido',
              inicio: recognized.inicio || '',
              inicioOrigem: recognized.inicioOrigem || null,
              disciplina: recognized.disciplina || '',
              professor: recognized.professor || '',
              sala: recognized.sala || '',
              pagina: recognized.pagina,
              bbox: recognized.bbox,
              textoOriginal: recognized.textoOriginal || recognized.textoDigital || '',
              incertezas: recognized.incertezas || [],
            };
            if (position.estado === 'reconhecido') cellsRecognized += 1;
            if (position.estado === 'vazio_documento') cellsEmpty += 1;
            if (['nao_reconhecido', 'parcial'].includes(position.estado)) cellsUnrecognized += 1;
            if (!turma.days[recognized.day]) turma.days[recognized.day] = { situacaoDocumento: 'nao_reconhecido', posicoes: [], avisos: [] };
            turma.days[recognized.day].posicoes.push(position);
            turma.days[recognized.day].situacaoDocumento = 'com_aulas';
          }
        }
      }
    } finally {
      if (!ocrEngine) await engine.close();
    }
    for (const turma of turmas.values()) {
      for (const day of DAYS) {
        if (!turma.days[day].posicoes.length) turma.days[day] = emptyDay('A estrutura deste dia não foi separada automaticamente; confirme se está vazio ou compartilhado.');
      }
      const { days, ...rest } = turma;
      Object.assign(turma, days);
      delete turma.days;
    }
    return {
      paginasAnalisadas: pagesResult.pageCount,
      turmas: [...turmas.values()],
      observacoes: pageDiagnostics.flatMap((page) => page.warnings),
      diagnosticoEstrutural: {
        motor: 'local-structure-ocr',
        paginas: pageDiagnostics,
        diasAnalisados: pageDiagnostics.reduce((total, page) => total + page.tables.length * DAYS.length, 0),
        celulasDetectadas: cellsDetected,
        celulasReconhecidas: cellsRecognized,
        celulasVazias: cellsEmpty,
        celulasIlegiveis: cellsUnrecognized,
        pendenciasEstruturais: pageDiagnostics.flatMap((page) => page.tables.flatMap((table) => table.warnings)),
      },
    };
  },
});
