import { getLayoutProfile } from '../../../shared/layout-profiles.js';
import { detectRasterLines } from './image-processing.js';

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
const normalize = (value) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const bounded = (value, maximum) => Math.max(0, Math.min(maximum, Number.isFinite(Number(value)) ? Number(value) : 0));
const DAY_LABELS = new Map(['SEGUNDA', 'TERCA', 'QUARTA', 'QUINTA', 'SEXTA'].flatMap((day) => [[day, day.toLowerCase()], [`${day}-FEIRA`, day.toLowerCase()]]));
export const normalizeDayLabel = (value) => DAY_LABELS.get(normalize(value)) || null;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const findClassCode = (text, classes) => classes.find((classCode) => {
  const normalizedText = normalize(text).replace(/[^A-Z0-9]+/g, ' ').trim();
  const normalizedClass = normalize(classCode).replace(/[^A-Z0-9]+/g, ' ').trim();
  return normalizedText === normalizedClass || normalizedText.includes(` ${normalizedClass}`) || normalizedText.endsWith(normalizedClass);
});

const centers = (items) => items.map((item) => ({ ...item, centerX: item.x + item.width / 2, centerY: item.y - item.height / 2 }));

export const detectClassHeaders = ({ textItems, classes }) => centers(textItems
  .map((item) => ({ ...item, classCode: findClassCode(item.text, classes) }))
  .filter((item) => item.classCode));

const boundariesFromCenters = (items, min, max) => {
  const sorted = items.slice().sort((left, right) => left.centerX - right.centerX);
  return sorted.map((item, index) => ({
    left: index === 0 ? min : (sorted[index - 1].centerX + item.centerX) / 2,
    right: index === sorted.length - 1 ? max : (item.centerX + sorted[index + 1].centerX) / 2,
  }));
};

const findRows = ({ textItems, pageHeight, profile }) => {
  const timeItems = centers(textItems.filter((item) => timePattern.test(item.text.trim())));
  const byTime = new Map();
  timeItems.forEach((item) => { if (!byTime.has(item.text.trim())) byTime.set(item.text.trim(), item); });
  const rows = [...byTime.values()].sort((left, right) => left.centerY - right.centerY);
  if (rows.length < 2) return { rows: [], confidence: 0, source: 'unavailable' };
  return {
    rows: rows.map((item, index) => ({
      posicao: profile?.startTimes.indexOf(item.text.trim()) + 1 || index + 1,
      inicio: item.text.trim(),
      inicioOrigem: 'documento',
      top: index === 0 ? 0 : (rows[index - 1].centerY + item.centerY) / 2,
      bottom: index === rows.length - 1 ? pageHeight : (item.centerY + rows[index + 1].centerY) / 2,
    })),
    confidence: Math.min(1, rows.length / 10),
    source: 'text',
  };
};

const findRasterRows = ({ lines, page, profile }) => {
  const scaleY = page.height / page.renderHeight;
  const boundaries = [...new Set((lines.horizontal || []).map((line) => Math.round(line * scaleY)))].sort((left, right) => left - right);
  const intervals = boundaries.slice(0, -1).map((top, index) => ({ top, bottom: boundaries[index + 1] })).filter((row) => row.bottom - row.top >= 12);
  if (intervals.length < 2) return { rows: [], confidence: 0, source: 'unavailable' };
  const usesProfile = Boolean(profile?.startTimes?.length === intervals.length);
  return {
    rows: intervals.map((row, index) => ({
      posicao: index + 1,
      inicio: usesProfile ? profile.startTimes[index] : '',
      inicioOrigem: usesProfile ? 'perfil_confirmado' : null,
      top: row.top,
      bottom: row.bottom,
    })),
    confidence: usesProfile ? 0.7 : 0.42,
    source: 'raster',
  };
};

export const findDayColumns = ({ textItems, region }) => {
  const labels = centers(textItems).filter((item) => {
    const day = normalizeDayLabel(item.text);
    return day && item.centerX >= region.left && item.centerX <= region.right;
  }).map((item) => ({ ...item, day: normalizeDayLabel(item.text) }));
  const unique = [...new Map(labels.map((item) => [item.day, item])).values()];
  if (unique.length !== 5) return [];
  return boundariesFromCenters(unique, region.left, region.right).map((boundary, index) => ({ ...boundary, day: DAYS[index] }));
};

const findDaySections = ({ textItems, region, pageHeight }) => {
  const labels = centers(textItems).filter((item) => {
    const day = normalizeDayLabel(item.text);
    return day && item.centerX >= region.left && item.centerX <= region.right;
  }).map((item) => ({ ...item, day: normalizeDayLabel(item.text) }));
  const unique = [...new Map(labels.map((item) => [item.day, item])).values()];
  if (unique.length !== 5) return [];
  const sorted = unique.slice().sort((left, right) => left.centerY - right.centerY);
  return sorted.map((item, index) => ({
    day: item.day,
    top: index === 0 ? 0 : (sorted[index - 1].centerY + item.centerY) / 2,
    bottom: index === sorted.length - 1 ? pageHeight : (item.centerY + sorted[index + 1].centerY) / 2,
  }));
};

const findRasterColumns = ({ lines, region, page }) => {
  const scaleX = page.width / page.renderWidth;
  const candidates = [...new Set((lines.vertical || []).map((line) => Math.round(line * scaleX)))]
    .filter((line) => line >= region.left && line <= region.right)
    .sort((left, right) => left - right);
  const columns = candidates.slice(0, -1).map((left, index) => ({ left, right: candidates[index + 1] }))
    .filter((column) => column.right - column.left >= 12);
  if (columns.length !== 5) return [];
  return columns.map((column, index) => ({ ...column, day: DAYS[index] }));
};

const collectCellText = (textItems, box) => textItems
  .filter((item) => {
    const centerX = item.x + item.width / 2;
    const centerY = item.y - item.height / 2;
    return centerX >= box.left && centerX <= box.right && centerY >= box.top && centerY <= box.bottom;
  })
  .map((item) => item.text.trim())
  .join(' ')
  .trim();

export const detectPageStructure = async ({ page, course, profile = getLayoutProfile(course.name), calibration }) => {
  const headers = detectClassHeaders({ textItems: page.textItems, classes: course.classes });
  const lines = await detectRasterLines(page.imageBuffer, { threshold: 0.18 });
  const detectedRegions = boundariesFromCenters(headers, 0, page.width).map((region, index) => ({
    ...region,
    classCode: headers[index].classCode,
    header: headers[index].text,
    confidence: headers.length > 1 ? 0.86 : 0.78,
  }));
  const savedTables = calibration?.pages?.find((entry) => entry.pageNumber === page.pageNumber)?.tables || [];
  const regions = savedTables.length ? savedTables.map((saved, index) => {
    const left = saved.relative ? bounded(saved.bbox?.left, 1) * page.width : bounded(saved.bbox?.left, page.width);
    const width = saved.relative ? bounded(saved.bbox?.width, 1 - left / page.width) * page.width : bounded(saved.bbox?.width, page.width - left);
    return {
    ...(detectedRegions[index] || { confidence: 0.7, header: saved.classCode }),
    classCode: saved.classCode,
    left,
    right: left + width,
  }; }) : detectedRegions;
  const tables = [];
  for (const region of regions) {
    const textRows = findRows({ textItems: page.textItems, pageHeight: page.height, profile });
    const detectedRows = textRows.rows.length ? textRows : findRasterRows({ lines, page, profile });
    const savedTable = savedTables.find((table) => table.classCode === region.classCode);
    const rows = savedTable?.rows?.length ? {
      ...detectedRows,
      rows: savedTable.rows.map((row) => {
        const top = savedTable.relative ? bounded(row.top, 1) * page.height : bounded(row.top, page.height);
        const bottom = savedTable.relative ? bounded(row.bottom, 1) * page.height : bounded(row.bottom, page.height);
        return { ...row, top: Math.min(top, bottom), bottom: Math.max(top, bottom) };
      }),
      confidence: Math.max(detectedRows.confidence, 0.7),
      source: 'calibration',
    } : detectedRows;
    const textColumns = findDayColumns({ textItems: page.textItems, region });
    const columns = textColumns.length ? textColumns : findRasterColumns({ lines, region, page });
    const sections = columns.length ? [] : findDaySections({ textItems: page.textItems, region, pageHeight: page.height });
    const cells = [];
    if (rows.rows.length && columns.length) {
      rows.rows.forEach((row) => columns.forEach((column) => cells.push({
        day: column.day,
        posicao: row.posicao,
        inicio: row.inicio,
        inicioOrigem: row.inicioOrigem,
        bbox: { left: column.left, top: row.top, width: column.right - column.left, height: row.bottom - row.top },
        textoDigital: collectCellText(page.textItems, { left: column.left, right: column.right, top: row.top, bottom: row.bottom }),
      })));
    } else if (rows.rows.length && sections.length) {
      sections.forEach((section) => rows.rows.filter((row) => row.top >= section.top && row.bottom <= section.bottom).forEach((row) => cells.push({
        day: section.day,
        posicao: row.posicao,
        inicio: row.inicio,
        inicioOrigem: row.inicioOrigem,
        bbox: { left: region.left, top: row.top, width: region.right - region.left, height: row.bottom - row.top },
        textoDigital: collectCellText(page.textItems, { left: region.left, right: region.right, top: row.top, bottom: row.bottom }),
      })));
    }
    tables.push({
      classCode: region.classCode,
      bbox: { left: region.left, top: 0, width: region.right - region.left, height: page.height },
      confidence: Math.min(region.confidence, rows.confidence || 0, (columns.length || sections.length ? 0.82 : 0.2)),
      rows: rows.rows,
      columns,
      sections,
      cells,
      lines: { horizontal: lines.horizontal, vertical: lines.vertical },
      warnings: cells.length ? [] : ['Não foi possível separar as colunas de dias e linhas da tabela com segurança.'],
    });
  }
  return {
    pageNumber: page.pageNumber,
    textSelectable: page.textItems.length > 0,
    tables,
    warnings: headers.length ? [] : ['Cabeçalho de turma não reconhecido nesta página.'],
  };
};
