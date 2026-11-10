import { courses } from '../config/courses.js';
import { DAYS, DAY_STATUSES, scheduleKey } from './schedule-model.js';

export const DRAFT_VERSION = 1;

const isKnownClass = (courseName, classCode) => courses.some(
  (course) => course.name === courseName && course.classes.includes(classCode),
);

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

export const createDraftPayload = (schedules) => ({
  version: DRAFT_VERSION,
  exportedAt: new Date().toISOString(),
  schedules,
});

export const serializeDraft = (schedules) => JSON.stringify(createDraftPayload(schedules), null, 2);

const validatePeriodData = (period) => isPlainObject(period)
  && typeof period.inicio === 'string'
  && typeof period.fim === 'string'
  && typeof period.disciplina === 'string'
  && typeof period.professor === 'string'
  && typeof period.sala === 'string';

export const validateDraftPayload = (payload) => {
  if (!isPlainObject(payload) || payload.version !== DRAFT_VERSION || !isPlainObject(payload.schedules)) {
    throw new Error('Formato de rascunho inválido ou versão não suportada.');
  }

  Object.entries(payload.schedules).forEach(([key, schedule]) => {
    if (!isPlainObject(schedule) || !isKnownClass(schedule.curso, schedule.turma) || key !== scheduleKey(schedule.curso, schedule.turma)) {
      throw new Error(`Turma inválida no rascunho: ${key}.`);
    }
    if (!isPlainObject(schedule.dias)) throw new Error(`Dias inválidos no rascunho: ${key}.`);
    DAYS.forEach(({ key: dayKey }) => {
      const day = schedule.dias[dayKey];
      if (!isPlainObject(day) || !DAY_STATUSES.includes(day.situacao) || !Array.isArray(day.periodos)) {
        throw new Error(`Dados inválidos para ${schedule.turma} em ${dayKey}.`);
      }
      if (!day.periodos.every(validatePeriodData)) throw new Error(`Período inválido para ${schedule.turma} em ${dayKey}.`);
      if (day.situacao === 'compartilhado' && !day.compartilhamento) {
        throw new Error(`Compartilhamento sem turma de origem para ${schedule.turma} em ${dayKey}.`);
      }
      if (day.situacao !== 'compartilhado' && day.compartilhamento) {
        throw new Error(`Vínculo inconsistente para ${schedule.turma} em ${dayKey}.`);
      }
      if (day.compartilhamento !== null && day.compartilhamento !== undefined
        && (!isKnownClass(day.compartilhamento.curso, day.compartilhamento.turma)
          || (day.compartilhamento.curso === schedule.curso && day.compartilhamento.turma === schedule.turma))) {
        throw new Error(`Compartilhamento inválido para ${schedule.turma} em ${dayKey}.`);
      }
    });
  });
  return payload;
};

export const parseDraft = (text) => {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    throw new Error('O arquivo selecionado não contém um JSON válido.');
  }
  return validateDraftPayload(payload);
};
