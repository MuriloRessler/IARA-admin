import { getCourse } from '../config/courses.js';

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];
let periodSequence = 0;
const nextPeriodId = () => `extracted-period-${++periodSequence}`;
const normalizeText = (value) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim() || '';
const validTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '');
const warning = (message, page = null) => ({ id: `${Date.now()}-${Math.random()}`, message, page, resolvido: false });

const createPeriod = () => ({ id: nextPeriodId(), inicio: '', fim: '', disciplina: '', professor: '', sala: '', paginaFonte: null, incertezas: [] });
const createSchedule = (course, classCode) => ({
  curso: course,
  turma: classCode,
  origem: 'extracao',
  revisao: 'nao_revisado',
  avisos: [],
  dias: Object.fromEntries(DAYS.map((day) => [day, {
    situacao: 'pendente', periodos: [], compartilhamento: null, revisao: 'nao_revisado', avisos: [],
  }])),
});

export const resolveExtractedClass = (value, course) => {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) return null;
  const matches = course.classes.filter((classCode) => {
    const normalizedClass = normalizeText(classCode);
    return normalizedValue === normalizedClass || normalizedValue.endsWith(` ${normalizedClass}`) || normalizedValue.includes(` ${normalizedClass} `);
  });
  return matches.length === 1 ? matches[0] : null;
};

const normalizeDay = (rawDay) => {
  const day = { situacao: 'pendente', periodos: [], compartilhamento: null, revisao: 'nao_revisado', avisos: [] };
  const sourceWarnings = [...(rawDay?.avisos || [])];
  if (rawDay?.situacaoDocumento === 'dia_em_branco') {
    day.avisos = [warning('O documento indica um dia em branco; confirme manualmente se não há aulas.')];
    return day;
  }
  day.periodos = (rawDay?.periodos || []).map((rawPeriod) => {
    const period = createPeriod();
    period.inicio = validTime(rawPeriod.inicio) ? rawPeriod.inicio : '';
    period.fim = validTime(rawPeriod.fim) ? rawPeriod.fim : '';
    period.disciplina = rawPeriod.disciplina || '';
    period.professor = rawPeriod.professor || '';
    period.sala = rawPeriod.sala || '';
    period.paginaFonte = rawPeriod.pagina || null;
    period.incertezas = rawPeriod.incertezas || [];
    if (rawPeriod.incertezas?.length) sourceWarnings.push(...rawPeriod.incertezas);
    return period;
  });
  if (day.periodos.length) day.situacao = 'com_aulas';
  if (!day.periodos.length || ['parcialmente_ilegivel', 'nao_reconhecido'].includes(rawDay?.situacaoDocumento)) {
    day.situacao = day.periodos.length ? 'com_aulas' : 'pendente';
  }
  day.avisos = sourceWarnings.map((message) => warning(message));
  return day;
};

export const normalizeExtraction = ({ extracted, courseName, fileName, pageCount }) => {
  const course = getCourse(courseName);
  if (!course) throw new Error('Unknown course');
  const schedules = {};
  const unrecognizedClasses = [];
  const warnings = [...(extracted.observacoes || [])];

  for (const extractedClass of extracted.turmas || []) {
    const classCode = resolveExtractedClass(extractedClass.turma, course);
    if (!classCode) {
      if (extractedClass.turma) unrecognizedClasses.push(extractedClass.turma);
      warnings.push(`Turma não reconhecida: ${extractedClass.turma || 'identificação ausente'}.`);
      continue;
    }
    const schedule = createSchedule(course.name, classCode);
    for (const day of DAYS) schedule.dias[day] = normalizeDay(extractedClass[day]);
    schedule.dias.segunda.avisos.push(...(extractedClass.avisos || []).map((message) => warning(message)));
    schedules[`${course.name}::${classCode}`] = schedule;
  }

  return {
    status: 'ready_for_review',
    curso: course.name,
    arquivo: fileName,
    paginasAnalisadas: extracted.paginasAnalisadas || pageCount,
    schedules,
    classes: Object.values(schedules).map((schedule) => schedule.turma),
    unrecognizedClasses,
    warnings,
    review: 'nao_revisado',
  };
};
