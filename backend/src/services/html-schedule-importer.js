import iconv from 'iconv-lite';
import * as cheerio from 'cheerio';
import { getAllClasses, getCourse } from '../config/courses.js';
import { ExtractionError } from './extraction-errors.js';
import { normalizeExtraction } from './extraction-normalizer.js';

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
const DAY_NAMES = {
  segunda: ['segunda', 'seg'],
  terca: ['terca', 'terca-feira', 'ter'],
  quarta: ['quarta', 'qua'],
  quinta: ['quinta', 'qui'],
  sexta: ['sexta', 'sex'],
};
const COURSE_ALIASES = {
  'Informática': ['INFO', 'INF'],
  'Eletrônica': ['ELO', 'ELE', 'ELETRONICA'],
  'Eletrotécnica': ['ELE', 'ELETRO', 'ELETROTECNICA'],
  'Mecânica': ['MEC', 'MECANICA'],
  'Design de Móveis': ['DES', 'DESIGN'],
  'Móveis': ['MOV', 'MOVEIS'],
  'Química': ['QUI', 'QUIMICA'],
  'Meio Ambiente': ['MAB', 'MA', 'MEIOAMBIENTE'],
};

const normalizeWhitespace = (value) => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const fold = (value) => normalizeWhitespace(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const compact = (value) => fold(value).replace(/[^A-Z0-9]/g, '');

const parsePositiveInteger = (value, fallback = 1) => {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

const getCharset = (buffer) => {
  const sample = buffer.toString('latin1', 0, Math.min(buffer.length, 8192));
  const declared = sample.match(/<meta[^>]+charset\s*=\s*["']?\s*([^\s"'>;]+)/i)?.[1]
    || sample.match(/content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';]+)/i)?.[1];
  if (declared) return declared.toLowerCase();
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf-8';
  if (buffer[0] === 0xff && buffer[1] === 0xfe) return 'utf-16le';
  if (buffer[0] === 0xfe && buffer[1] === 0xff) return 'utf-16be';
  return 'utf-8';
};

export const decodeHtmlBuffer = (buffer) => {
  const charset = getCharset(buffer);
  if (/utf-16/i.test(charset)) return iconv.decode(buffer, charset);
  if (/utf-?8/i.test(charset)) return buffer.toString('utf8');
  if (/8859-1|latin-1|iso[-_]?ir[-_]?100[-_]?1/i.test(charset)) return iconv.decode(buffer, 'windows-1252');
  if (/windows[-_]?1252|cp1252/i.test(charset)) return iconv.decode(buffer, 'windows-1252');
  return iconv.decode(buffer, 'windows-1252');
};

const isEmptyCell = (value) => !value || /^[-–—]+$/.test(value);

const resolveDay = (value) => {
  const normalized = fold(value).replace(/\s+/g, ' ');
  return DAYS.find((day) => DAY_NAMES[day].some((name) => normalized === name.toUpperCase() || normalized.startsWith(`${name.toUpperCase()}-`))) || null;
};

const resolveStart = (value) => {
  const match = normalizeWhitespace(value).match(/\b([01]\d|2[0-3])\s*[:h]\s*([0-5]\d)\b/);
  return match ? `${match[1]}:${match[2]}` : '';
};

const balanceParentheses = (value) => {
  let level = 0;
  for (const character of value) {
    if (character === '(') level += 1;
    if (character === ')') level -= 1;
    if (level < 0) return false;
  }
  return level === 0;
};

export const parseCellValue = (value) => {
  const text = normalizeWhitespace(value);
  if (isEmptyCell(text)) {
    return { estado: 'vazio_documento', disciplina: '', professor: '', textoOriginal: text, incertezas: [] };
  }

  const opening = text.indexOf('(');
  if (opening >= 0 && text.endsWith(')') && balanceParentheses(text.slice(opening))) {
    const disciplina = text.slice(0, opening).trim();
    const professor = text.slice(opening + 1, -1).trim();
    if (disciplina && professor) {
      return { estado: 'reconhecido', disciplina, professor, textoOriginal: text, incertezas: [] };
    }
  }

  return {
    estado: 'parcial',
    disciplina: text,
    professor: '',
    textoOriginal: text,
    incertezas: ['A célula não segue claramente o formato Disciplina (Professor); confirme o conteúdo.'],
  };
};

const resolveClassHeader = (value) => {
  const header = normalizeWhitespace(value);
  const headerCompact = compact(header);
  const matches = getAllClasses().filter(({ course, classCode }) => COURSE_ALIASES[course]
    .some((alias) => headerCompact.includes(`${compact(alias)}${compact(classCode)}`)));
  if (matches.length === 1) return { ...matches[0], header, matches };
  return { header, matches };
};

const isPotentialClassHeader = (value) => /[A-Za-zÀ-ÿ]{2,}\s*\d/.test(value || '');

const directRows = ($, table) => {
  const rows = $(table).children('thead, tbody, tfoot').children('tr').toArray();
  return rows.length ? rows : $(table).children('tr').toArray();
};

export const expandTable = ($, table) => {
  const rows = directRows($, table);
  const grid = [];
  const cells = [];

  rows.forEach((row, rowIndex) => {
    if (!grid[rowIndex]) grid[rowIndex] = [];
    let column = 0;
    $(row).children('th, td').each((_cellIndex, element) => {
      while (grid[rowIndex][column]) column += 1;
      const rowspan = parsePositiveInteger($(element).attr('rowspan'));
      const colspan = parsePositiveInteger($(element).attr('colspan'));
      const cell = { element, rowIndex, text: normalizeWhitespace($(element).text()), rowspan, colspan };
      cells.push(cell);
      for (let rowOffset = 0; rowOffset < rowspan; rowOffset += 1) {
        const targetRow = rowIndex + rowOffset;
        if (!grid[targetRow]) grid[targetRow] = [];
        for (let columnOffset = 0; columnOffset < colspan; columnOffset += 1) {
          const targetColumn = column + columnOffset;
          if (grid[targetRow][targetColumn] && grid[targetRow][targetColumn] !== cell) {
            throw new ExtractionError('HTML_TABLE_INVALID', 'A tabela HTML possui células sobrepostas.', 422);
          }
          grid[targetRow][targetColumn] = cell;
        }
      }
      column += colspan;
    });
  });

  return { grid, rows, cells };
};

const findTable = ($) => {
  const candidates = $('table').toArray().map((table) => ({ table, rowCount: directRows($, table).length }));
  return candidates.sort((left, right) => right.rowCount - left.rowCount)[0]?.table || null;
};

const createRawDay = () => ({ situacaoDocumento: 'com_aulas', posicoes: [], avisos: [] });

const buildRawClass = ({ course, classCode }) => ({
  turma: classCode,
  curso: course,
  turmaAssociacao: { regiao: 'html', confianca: 'confiavel' },
  avisos: [],
  ...Object.fromEntries(DAYS.map((day) => [day, createRawDay()])),
});

export const parseScheduleHtml = ({ html, fileName = 'horarios.html' }) => {
  const $ = cheerio.load(html, { decodeEntities: true, xml: false });
  $('script, style, iframe, object, embed, link').remove();
  const table = findTable($);
  if (!table) throw new ExtractionError('HTML_TABLE_REQUIRED', 'Não foi encontrada uma tabela HTML de horários.', 422);

  let expanded;
  try {
    expanded = expandTable($, table);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('HTML_TABLE_INVALID', 'Não foi possível expandir a estrutura da tabela HTML.', 422);
  }

  const headerIndex = expanded.grid.findIndex((row) => row?.some((cell) => resolveClassHeader(cell?.text || '').matches?.length === 1));
  if (headerIndex < 0) throw new ExtractionError('HTML_HEADER_INVALID', 'A linha de cabeçalho não contém turmas reconhecidas do catálogo.', 422);
  const header = expanded.grid[headerIndex];
  const dayColumn = header.findIndex((cell) => /\bDIA\b/.test(fold(cell?.text)));
  const startColumn = header.findIndex((cell) => /INICIO|HORARIO|HORA/.test(compact(cell?.text)));
  if (dayColumn < 0 || startColumn < 0) throw new ExtractionError('HTML_HEADER_INVALID', 'O cabeçalho precisa identificar o dia e o horário de início.', 422);

  const classColumns = [];
  const warnings = [];
  const seenClasses = new Set();
  header.forEach((cell, columnIndex) => {
    if (!cell || columnIndex === dayColumn || columnIndex === startColumn) return;
    const resolved = resolveClassHeader(cell.text);
    if (resolved.matches?.length === 1) {
      const key = `${resolved.course}::${resolved.classCode}`;
      if (!seenClasses.has(key)) {
        classColumns.push({ ...resolved, columnIndex });
        seenClasses.add(key);
      } else {
        warnings.push(`A turma ${resolved.classCode} aparece mais de uma vez no cabeçalho; somente a primeira coluna foi importada.`);
      }
    } else if (resolved.matches?.length > 1) {
      warnings.push(`Cabeçalho de turma ambíguo: ${resolved.header}.`);
    } else if (isPotentialClassHeader(cell.text) && !/COORD|REUN|PROF|SETOR|OBS/i.test(cell.text)) {
      warnings.push(`Cabeçalho de turma não reconhecido: ${cell.text}.`);
    }
  });

  if (!classColumns.length) throw new ExtractionError('HTML_CLASSES_REQUIRED', 'Nenhuma coluna de turma reconhecida foi encontrada no cabeçalho.', 422);

  const classes = new Map(classColumns.map(({ course, classCode }) => [`${course}::${classCode}`, buildRawClass({ course, classCode })]));
  const dayCounts = Object.fromEntries(DAYS.map((day) => [day, 0]));
  let currentDay = null;
  let structuralWarnings = [];

  for (const row of expanded.grid.slice(headerIndex + 1)) {
    const dayCell = row?.[dayColumn];
    const dayText = dayCell?.text || '';
    const detectedDay = resolveDay(dayText);
    if (detectedDay) currentDay = detectedDay;
    if (!currentDay) {
      structuralWarnings.push('Uma linha de dados não possui dia da semana reconhecível.');
      continue;
    }
    if (!detectedDay && !dayCell) structuralWarnings.push(`A linha do ${currentDay} depende de uma célula rowspan ausente.`);
    dayCounts[currentDay] += 1;
    if (dayCounts[currentDay] > 10) throw new ExtractionError('HTML_ROWS_INVALID', `O dia ${currentDay} possui mais de 10 períodos.`, 422);
    const position = dayCounts[currentDay];
    const inicio = resolveStart(row?.[startColumn]?.text || '');
    if (!inicio) structuralWarnings.push(`${currentDay}: o horário da posição ${position} não foi reconhecido.`);

    for (const classColumn of classColumns) {
      const schedule = classes.get(`${classColumn.course}::${classColumn.classCode}`);
      const cell = row?.[classColumn.columnIndex];
      const parsed = parseCellValue(cell?.text || '');
      schedule[currentDay].posicoes.push({
        posicao: position,
        posicoesAssociadas: [],
        ...parsed,
        inicio,
        sala: '',
        pagina: 1,
        origem: 'html',
      });
    }
  }

  const missingDays = DAYS.filter((day) => dayCounts[day] !== 10);
  if (missingDays.length) {
    throw new ExtractionError('HTML_ROWS_INVALID', `A tabela precisa conter 10 períodos para cada dia; estrutura ausente ou incompleta: ${missingDays.join(', ')}.`, 422, { dayCounts });
  }
  if (structuralWarnings.length) warnings.push(...structuralWarnings);

  const expected = new Set(getAllClasses().map(({ course, classCode }) => `${course}::${classCode}`));
  const missingClasses = [...expected].filter((key) => !classes.has(key)).map((key) => key.split('::'))
    .map(([course, classCode]) => ({ course, classCode }));
  return {
    fileName,
    classes: [...classes.values()],
    warnings,
    missingClasses,
    dayCounts,
    headerColumns: header.length,
    dataRows: expanded.grid.length - headerIndex - 1,
  };
};

const sumDiagnostics = (results) => results.reduce((summary, result) => {
  for (const key of ['turmasDetectadas', 'turmasReconhecidas', 'turmasNaoReconhecidas', 'posicoesIdentificadas', 'posicoesPreenchidas', 'posicoesVazias', 'posicoesNaoReconhecidas', 'posicoesParciais', 'posicoesEsperadas', 'posicoesFaltantes', 'avisos']) summary[key] = (summary[key] || 0) + (result.diagnostico?.[key] || 0);
  return summary;
}, {});

export const importHtmlSchedules = ({ buffer, fileName, mimeType, maxSizeMb }) => {
  if (!buffer?.length) throw new ExtractionError('HTML_REQUIRED', 'Envie um arquivo HTML.', 400);
  if (buffer.length > maxSizeMb * 1024 * 1024) throw new ExtractionError('HTML_TOO_LARGE', `O HTML excede o limite de ${maxSizeMb} MB.`, 413);
  if (!/\.html?$/i.test(fileName || '')) throw new ExtractionError('HTML_EXTENSION_INVALID', 'Envie um arquivo com extensão .html ou .htm.', 415);
  if (mimeType && !['text/html', 'application/xhtml+xml', 'application/octet-stream'].includes(mimeType)) {
    throw new ExtractionError('HTML_MIME_INVALID', 'O tipo MIME informado não é HTML.', 415);
  }
  const html = decodeHtmlBuffer(buffer);
  if (!/<table\b/i.test(html)) throw new ExtractionError('HTML_TABLE_REQUIRED', 'O arquivo não contém uma tabela HTML.', 422);
  const parsed = parseScheduleHtml({ html, fileName });
  const grouped = new Map();
  for (const extractedClass of parsed.classes) {
    if (!getCourse(extractedClass.curso)) continue;
    if (!grouped.has(extractedClass.curso)) grouped.set(extractedClass.curso, []);
    grouped.get(extractedClass.curso).push(extractedClass);
  }
  const normalizedResults = [...grouped.entries()].map(([courseName, classes]) => normalizeExtraction({
    extracted: { paginasAnalisadas: 1, turmas: classes, observacoes: parsed.warnings, diagnosticoEstrutural: { motor: 'structured-html', dataRows: parsed.dataRows, headerColumns: parsed.headerColumns, dayCounts: parsed.dayCounts } },
    courseName,
    fileName,
    pageCount: 1,
    origin: 'html',
  }));
  const schedules = Object.assign({}, ...normalizedResults.map((result) => result.schedules));
  const diagnostics = sumDiagnostics(normalizedResults);
  const unrecognizedClasses = normalizedResults.flatMap((result) => result.unrecognizedClasses || []);
  return {
    status: 'ready_for_review',
    origem: 'html',
    arquivo: fileName,
    paginasAnalisadas: 1,
    schedules,
    classes: Object.values(schedules).map((schedule) => schedule.turma),
    unrecognizedClasses,
    warnings: [...new Set([...parsed.warnings, ...normalizedResults.flatMap((result) => result.warnings || [])])],
    diagnostico: {
      ...diagnostics,
      cursosDetectados: grouped.size,
      classesDetectadas: parsed.classes.length,
      colunasCabeçalho: parsed.headerColumns,
      linhasDados: parsed.dataRows,
      diasAnalisados: DAYS.length,
      diasPendentes: Object.values(schedules).reduce((count, schedule) => count + Object.values(schedule.dias).filter((day) => day.situacao === 'pendente').length, 0),
      turmasAusentes: parsed.missingClasses,
    },
    diagnosticoEstrutural: { motor: 'structured-html', dataRows: parsed.dataRows, headerColumns: parsed.headerColumns, dayCounts: parsed.dayCounts },
    review: 'nao_revisado',
  };
};
