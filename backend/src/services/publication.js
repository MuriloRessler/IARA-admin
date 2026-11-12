import { createHash } from 'node:crypto';
import { courses, getAllClasses, totalClasses } from '../config/courses.js';

export const PUBLICATION_TABLE = 'public."Horarios"';
export const PUBLICATION_VERSION = 1;

const DAY_ORDER = [
  ['segunda', 'SEGUNDA-FEIRA'],
  ['terca', 'TERÇA-FEIRA'],
  ['quarta', 'QUARTA-FEIRA'],
  ['quinta', 'QUINTA-FEIRA'],
  ['sexta', 'SEXTA-FEIRA'],
];
const DAY_STATUSES = new Set(['com_aulas', 'compartilhado', 'sem_aulas', 'pendente']);
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const BLOCKING_STATES = new Set(['nao_reconhecido', 'parcial']);

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const scheduleKey = (course, classCode) => `${course}::${classCode}`;
const isValidTime = (value) => TIME_PATTERN.test(value || '');
const timeToMinutes = (value) => {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const issue = (code, path, message) => ({ code, path, message });

const createReviewState = () => ({
  unreviewedSchedules: 0,
  unreviewedDays: 0,
  unreviewedPeriods: 0,
  classes: new Map(),
  days: new Map(DAY_ORDER.map(([key, label]) => [key, { key, label, unreviewedDays: 0, unreviewedPeriods: 0 }])),
});

const reviewClass = (state, schedule) => {
  const key = scheduleKey(schedule.curso, schedule.turma);
  if (!state.classes.has(key)) state.classes.set(key, { key, curso: schedule.curso, turma: schedule.turma, unreviewedSchedule: false, unreviewedDays: 0, unreviewedPeriods: 0, days: [] });
  return state.classes.get(key);
};

const recordUnreviewedSchedule = (state, schedule) => {
  const entry = reviewClass(state, schedule);
  if (!entry.unreviewedSchedule) {
    entry.unreviewedSchedule = true;
    state.unreviewedSchedules += 1;
  }
};

const recordUnreviewedDay = (state, schedule, dayKey, label) => {
  const entry = reviewClass(state, schedule);
  const day = state.days.get(dayKey);
  entry.unreviewedDays += 1;
  entry.days.push({ key: dayKey, label, unreviewedDay: true, unreviewedPeriods: 0, periods: [] });
  state.unreviewedDays += 1;
  if (day) day.unreviewedDays += 1;
};

const recordUnreviewedPeriod = (state, schedule, dayKey, label, period, index) => {
  const entry = reviewClass(state, schedule);
  let dayEntry = entry.days.find((candidate) => candidate.key === dayKey);
  if (!dayEntry) {
    dayEntry = { key: dayKey, label, unreviewedDay: false, unreviewedPeriods: 0, periods: [] };
    entry.days.push(dayEntry);
  }
  dayEntry.unreviewedPeriods += 1;
  dayEntry.periods.push({ index, posicao: period?.posicao ?? null, inicio: period?.inicio || null });
  state.unreviewedPeriods += 1;
  const day = state.days.get(dayKey);
  if (day) day.unreviewedPeriods += 1;
};

const finalizeReviewState = (state, recordCount) => {
  const classes = [...state.classes.values()]
    .filter((entry) => entry.unreviewedSchedule || entry.unreviewedDays > 0 || entry.unreviewedPeriods > 0)
    .map((entry) => ({ ...entry, days: entry.days.map((day) => ({ ...day, periods: day.periods.map((period) => ({ ...period })) })) }));
  return {
    complete: state.unreviewedSchedules === 0 && state.unreviewedDays === 0 && state.unreviewedPeriods === 0,
    turmasCompletamenteRevisadas: Math.max(0, recordCount - classes.length),
    turmasComRevisaoIncompleta: classes.length,
    turmasNaoRevisadas: state.unreviewedSchedules,
    diasNaoRevisados: state.unreviewedDays,
    periodosNaoRevisados: state.unreviewedPeriods,
    byDay: [...state.days.values()],
    classes,
  };
};

const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

export const comparableRecord = (record) => ({
  id: record?.id ?? null,
  turma: record?.turma ?? null,
  curso: record?.curso ?? null,
  horario: record?.horario ?? null,
});

export const recordsChecksum = (records = []) => createHash('sha256')
  .update(stableStringify(records.map(comparableRecord).sort((left, right) => String(left.turma || '').localeCompare(String(right.turma || '')))))
  .digest('hex');

const sourceDay = (schedules, schedule, dayKey) => {
  const day = schedule?.dias?.[dayKey];
  if (!day || day.situacao !== 'compartilhado' || !day.compartilhamento) return { periods: day?.periodos || [] };
  const visited = new Set();
  let current = schedule;
  while (current?.dias?.[dayKey]?.situacao === 'compartilhado') {
    const currentKey = scheduleKey(current.curso, current.turma);
    if (visited.has(currentKey)) return { periods: [], error: 'Referência circular entre turmas.' };
    visited.add(currentKey);
    const link = current.dias[dayKey].compartilhamento;
    current = schedules[scheduleKey(link.curso, link.turma)];
    if (!current) return { periods: [], error: 'Turma de origem do compartilhamento não encontrada.' };
  }
  return { periods: current?.dias?.[dayKey]?.periodos || [], inherited: true };
};

const formatPeriod = (period) => {
  if (period.estado === 'vazio_documento') return `POSIÇÃO ${period.posicao || '?'}: CÉLULA VAZIA NO DOCUMENTO`;
  const details = [period.professor && `Professor: ${period.professor}`, period.sala && `Sala: ${period.sala}`]
    .filter(Boolean)
    .join(' | ');
  return `${period.inicio} - ${period.disciplina}${details ? ` | ${details}` : ''}`;
};

export const formatPublicationText = (schedule, schedules) => {
  const lines = [`TURMA: ${schedule.turma}`, '', `CURSO: ${schedule.curso}`];
  for (const [dayKey, label] of DAY_ORDER) {
    const day = schedule.dias[dayKey];
    lines.push('', label);
    if (!day) {
      lines.push('DIA NÃO CONFIGURADO');
      continue;
    }
    if (day.situacao === 'sem_aulas') {
      lines.push('SEM AULAS CONFIRMADAS');
      continue;
    }
    const effective = sourceDay(schedules, schedule, dayKey);
    effective.periods
      .slice()
      .sort((left, right) => (timeToMinutes(left.inicio) ?? 0) - (timeToMinutes(right.inicio) ?? 0))
      .forEach((period) => lines.push(formatPeriod(period)));
  }
  return lines.join('\n');
};

const classifyPeriod = (period) => {
  if (period.estado === 'vazio_documento') return 'empty';
  if (period.manualOverride || period.compartilhamentoStatus === 'substituida') return 'manual';
  if (['automatico', 'sugerida', 'confirmada'].includes(period.compartilhamentoStatus)) return 'shared';
  return 'own';
};

const summarizeSchedule = (schedule, schedules) => {
  const summary = { proprias: 0, compartilhadas: 0, manuais: 0 };
  for (const [dayKey] of DAY_ORDER) {
    const day = schedule.dias[dayKey];
    if (!day) continue;
    const effective = sourceDay(schedules, schedule, dayKey);
    const periods = day.situacao === 'compartilhado'
      ? effective.periods.map((period) => ({ ...period, compartilhamentoStatus: 'automatico' }))
      : day.periodos;
    periods.forEach((period) => {
      const category = classifyPeriod(period);
      if (category === 'own') summary.proprias += 1;
      if (category === 'shared') summary.compartilhadas += 1;
      if (category === 'manual') summary.manuais += 1;
    });
  }
  return summary;
};

const validateDay = (schedule, dayKey, day, schedules, issues, warnings, reviewState) => {
  const path = `${scheduleKey(schedule.curso, schedule.turma)}.dias.${dayKey}`;
  const dayLabel = DAY_ORDER.find(([key]) => key === dayKey)?.[1] || dayKey;
  if (!isObject(day) || !DAY_STATUSES.has(day.situacao) || !Array.isArray(day.periodos)) {
    issues.push(issue('INVALID_DAY', path, 'O dia possui uma estrutura inválida.'));
    return;
  }
  if (day.revisao !== 'revisado') recordUnreviewedDay(reviewState, schedule, dayKey, dayLabel);
  if (!Array.isArray(day.avisos)) issues.push(issue('INVALID_WARNINGS', path, 'A lista de avisos do dia é inválida.'));
  if (Array.isArray(day.avisos) && day.avisos.some((warning) => !warning.resolvido)) issues.push(issue('UNRESOLVED_WARNING', path, 'O dia possui avisos ainda não conferidos.'));
  if (day.situacao === 'pendente') {
    issues.push(issue('PENDING_DAY', path, 'O dia permanece pendente de decisão administrativa.'));
    return;
  }
  if (day.situacao === 'sem_aulas') {
    if (day.periodos.length) issues.push(issue('EMPTY_DAY_WITH_PERIODS', path, 'Um dia confirmado sem aulas não pode conter períodos.'));
    return;
  }
  if (day.situacao === 'compartilhado') {
    if (!day.compartilhamento) issues.push(issue('MISSING_SHARED_SOURCE', path, 'O dia compartilhado não possui uma turma de origem.'));
    if (day.periodos.length) issues.push(issue('SHARED_DAY_HAS_LOCAL_PERIODS', path, 'Um dia compartilhado não pode conter períodos locais.'));
    const effective = sourceDay(schedules, schedule, dayKey);
    if (effective.error) issues.push(issue('INVALID_SHARED_SOURCE', path, effective.error));
    if (!effective.periods.length) warnings.push(issue('EMPTY_SHARED_DAY', path, 'O dia compartilhado não possui períodos efetivos.'));
  }
  if (day.situacao === 'com_aulas' && !day.periodos.length) issues.push(issue('EMPTY_SCHEDULED_DAY', path, 'Um dia com aulas precisa possuir períodos ou ser confirmado como sem aulas.'));
  const seen = new Set();
  day.periodos.forEach((period, index) => {
    const periodPath = `${path}.periodos.${index}`;
    if (!isObject(period)) {
      issues.push(issue('INVALID_PERIOD', periodPath, 'O período possui uma estrutura inválida.'));
      return;
    }
    if (Object.hasOwn(period, 'fim') || Object.hasOwn(period, 'fimPendente')) issues.push(issue('END_TIME_NOT_ALLOWED', periodPath, 'Horários de término não fazem parte do modelo publicado.'));
    if (!isValidTime(period.inicio)) issues.push(issue('INVALID_START_TIME', periodPath, 'O início deve usar o formato HH:MM.'));
    const identity = `${period.posicao ?? ''}|${period.inicio || ''}`;
    if (seen.has(identity)) issues.push(issue('DUPLICATE_PERIOD', periodPath, 'Há posições duplicadas no mesmo dia e horário.'));
    seen.add(identity);
    if (!period.estado || !['reconhecido', 'vazio_documento', 'nao_reconhecido', 'parcial'].includes(period.estado)) issues.push(issue('INVALID_PERIOD_STATE', periodPath, 'O estado de leitura do período é inválido.'));
    if (BLOCKING_STATES.has(period.estado)) issues.push(issue('UNRECOGNIZED_PERIOD', periodPath, 'Aula não reconhecida ou parcial exige correção antes da publicação.'));
    if (period.estado !== 'vazio_documento' && (typeof period.disciplina !== 'string' || !period.disciplina.trim())) issues.push(issue('MISSING_SUBJECT', periodPath, 'A disciplina é obrigatória para uma aula reconhecida.'));
    if (period.revisao !== 'revisado') recordUnreviewedPeriod(reviewState, schedule, dayKey, dayLabel, period, index);
  });
};

export const validatePublicationSchedules = (schedules) => {
  const issues = [];
  const warnings = [];
  const records = [];
  const reviewState = createReviewState();
  if (!isObject(schedules)) {
    return { valid: false, issues: [issue('INVALID_SCHEDULES', 'schedules', 'As grades devem ser enviadas como um objeto.')], warnings, records, summary: null, review: finalizeReviewState(reviewState, 0) };
  }

  const expected = new Map(getAllClasses().map(({ course, classCode }) => [scheduleKey(course, classCode), { curso: course, turma: classCode }]));
  const seen = new Set();
  Object.entries(schedules).forEach(([key, schedule]) => {
    if (!isObject(schedule) || !expected.has(key) || typeof schedule.curso !== 'string' || typeof schedule.turma !== 'string' || scheduleKey(schedule.curso, schedule.turma) !== key) {
      issues.push(issue('UNKNOWN_OR_MISMATCHED_CLASS', key, 'A turma ou o curso não pertence ao catálogo oficial.'));
      return;
    }
    if (seen.has(key)) issues.push(issue('DUPLICATE_CLASS', key, 'A turma foi enviada mais de uma vez.'));
    seen.add(key);
    const expectedClass = expected.get(key);
    if (expectedClass.curso !== schedule.curso || expectedClass.turma !== schedule.turma) {
      issues.push(issue('COURSE_CLASS_MISMATCH', key, 'A associação entre curso e turma é inválida.'));
      return;
    }
    if (!isObject(schedule.dias)) {
      issues.push(issue('MISSING_DAYS', key, 'A grade não possui os dias da semana.'));
      return;
    }
    if (schedule.revisao !== 'revisado') recordUnreviewedSchedule(reviewState, schedule);
    DAY_ORDER.forEach(([dayKey]) => validateDay(schedule, dayKey, schedule.dias[dayKey], schedules, issues, warnings, reviewState));
    const horario = formatPublicationText(schedule, schedules);
    if (!horario.trim()) issues.push(issue('EMPTY_TEXT', key, 'A turma não gerou texto publicável.'));
    records.push({ turma: schedule.turma, curso: schedule.curso, horario });
  });
  expected.forEach((_value, key) => {
    if (!seen.has(key)) issues.push(issue('MISSING_CLASS', key, 'A turma oficial não foi enviada.'));
  });

  const counts = Object.values(schedules).reduce((total, schedule) => {
    if (!isObject(schedule) || !isObject(schedule.dias)) return total;
    const current = summarizeSchedule(schedule, schedules);
    total.proprias += current.proprias;
    total.compartilhadas += current.compartilhadas;
    total.manuais += current.manuais;
    return total;
  }, { proprias: 0, compartilhadas: 0, manuais: 0 });
  const summary = {
    turmas: records.length,
    cursos: new Set(records.map((record) => record.curso)).size,
    aulasProprias: counts.proprias,
    aulasCompartilhadas: counts.compartilhadas,
    alteracoesManuais: counts.manuais,
  };
  const sortedRecords = records.sort((left, right) => left.turma.localeCompare(right.turma));
  const review = finalizeReviewState(reviewState, sortedRecords.length);
  return {
    version: PUBLICATION_VERSION,
    valid: issues.length === 0,
    issues,
    warnings,
    records: sortedRecords,
    summary,
    review,
    publicationVersion: recordsChecksum(sortedRecords.map((record) => ({ ...record, id: null }))),
  };
};

export const comparePublicationRecords = (nextRecords, currentRecords = []) => {
  const expectedKeys = new Set(nextRecords.map((record) => record.turma));
  const currentByClass = new Map();
  const duplicateClasses = [];
  const legacyRecords = [];
  const extraRecords = [];
  currentRecords.forEach((record) => {
    if (!record.turma) {
      legacyRecords.push(comparableRecord(record));
      return;
    }
    if (currentByClass.has(record.turma)) duplicateClasses.push(record.turma);
    currentByClass.set(record.turma, record);
    if (!expectedKeys.has(record.turma)) extraRecords.push(comparableRecord(record));
  });
  const created = [];
  const updated = [];
  const unchanged = [];
  nextRecords.forEach((record) => {
    const current = currentByClass.get(record.turma);
    if (!current) {
      created.push({ after: record });
      return;
    }
    const before = { turma: current.turma, curso: current.curso, horario: current.horario };
    if (before.curso === record.curso && before.horario === record.horario) unchanged.push({ id: current.id ?? null, before, after: record });
    else updated.push({ id: current.id ?? null, before, after: record });
  });
  return {
    created,
    updated,
    unchanged,
    legacyRecords,
    extraRecords,
    duplicateClasses,
    currentChecksum: recordsChecksum(currentRecords),
  };
};

export const createPublicationError = (code, message, statusCode = 400, details = null) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.expose = true;
  error.details = details;
  return error;
};

export const totalOfficialClasses = totalClasses;
export const officialCourses = courses;
