import { courses } from '../config/courses.js';
import { DAYS, DAY_STATUSES, scheduleKey } from './schedule-model.js';
import { createSharingState } from '../../../shared/schedule-sharing.js';

export const DRAFT_VERSION = 3;
export const LEGACY_DRAFT_VERSION = 1;
export const PREVIOUS_DRAFT_VERSION = 2;

const isKnownClass = (courseName, classCode) => courses.some(
  (course) => course.name === courseName && course.classes.includes(classCode),
);

const isPlainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const stripLegacyEnd = (period) => {
  const { fim: _legacyEnd, fimPendente: _legacyEndPending, ...current } = period;
  return current;
};

const normalizeSchedule = (schedule) => ({
  ...schedule,
  dias: Object.fromEntries(Object.entries(schedule.dias).map(([dayKey, day]) => [dayKey, {
    ...day,
    periodos: day.periodos.map(stripLegacyEnd),
  }])),
});

const normalizeSharing = (sharing) => ({
  version: 1,
  pairDecisions: Object.fromEntries(Object.entries(sharing?.pairDecisions || {}).map(([key, decision]) => [key, {
    id: decision.id,
    status: decision.status,
    first: decision.first,
    second: decision.second,
  }])),
  suggestions: Object.fromEntries(Object.entries(sharing?.suggestions || {}).map(([key, suggestion]) => [key, {
    id: suggestion.id,
    pairId: suggestion.pairId,
    target: suggestion.target,
    source: suggestion.source,
    dayKey: suggestion.dayKey,
    posicao: suggestion.posicao,
    inicio: suggestion.inicio,
    sourceFingerprint: suggestion.sourceFingerprint,
    sourcePeriodId: suggestion.sourcePeriodId || null,
    period: stripLegacyEnd(suggestion.period || {}),
    status: suggestion.status,
    manualOverride: Boolean(suggestion.manualOverride),
  }])),
});

export const createDraftPayload = (schedules, sharing = createSharingState()) => ({
  version: DRAFT_VERSION,
  exportedAt: new Date().toISOString(),
  schedules: Object.fromEntries(Object.entries(schedules).map(([key, schedule]) => [key, normalizeSchedule(schedule)])),
  sharing: normalizeSharing(sharing),
});

export const serializeDraft = (schedules, sharing) => JSON.stringify(createDraftPayload(schedules, sharing), null, 2);

const validatePeriodData = (period) => isPlainObject(period)
  && typeof period.inicio === 'string'
  && typeof period.disciplina === 'string'
  && typeof period.professor === 'string'
  && typeof period.sala === 'string';

export const validateDraftPayload = (payload) => {
  if (!isPlainObject(payload) || ![LEGACY_DRAFT_VERSION, PREVIOUS_DRAFT_VERSION, DRAFT_VERSION].includes(payload.version) || !isPlainObject(payload.schedules)) {
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
  if (payload.version === DRAFT_VERSION) {
    if (!isPlainObject(payload.sharing) || payload.sharing.version !== 1 || !isPlainObject(payload.sharing.pairDecisions) || !isPlainObject(payload.sharing.suggestions)) {
      throw new Error('Dados de compartilhamento invÃ¡lidos no rascunho.');
    }
    Object.values(payload.sharing.pairDecisions).forEach((decision) => {
      if (!isPlainObject(decision) || !['pending', 'confirmed', 'automatico'].includes(decision.status) || !isPlainObject(decision.first) || !isPlainObject(decision.second)
        || !isKnownClass(decision.first.curso, decision.first.turma) || !isKnownClass(decision.second.curso, decision.second.turma)
        || (decision.first.curso === decision.second.curso && decision.first.turma === decision.second.turma)) {
        throw new Error('DecisÃ£o de parceira invÃ¡lida no rascunho.');
      }
    });
    Object.values(payload.sharing.suggestions).forEach((suggestion) => {
      if (!isPlainObject(suggestion) || !['automatico', 'sugerida', 'confirmada', 'rejeitada', 'substituida'].includes(suggestion.status) || !isPlainObject(suggestion.period)
        || !isPlainObject(suggestion.target) || !isPlainObject(suggestion.source)
        || !isKnownClass(suggestion.target.curso, suggestion.target.turma) || !isKnownClass(suggestion.source.curso, suggestion.source.turma)) {
        throw new Error('SugestÃ£o de compartilhamento invÃ¡lida no rascunho.');
      }
    });
    return payload;
  }
  return {
    ...payload,
    version: DRAFT_VERSION,
    schedules: Object.fromEntries(Object.entries(payload.schedules).map(([key, schedule]) => [key, normalizeSchedule(schedule)])),
    sharing: createSharingState(),
  };
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
