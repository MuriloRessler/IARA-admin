import { isValidTime } from './schedule-validation.js';

const uniquePositions = (slots) => new Set(slots.map((slot) => Number(slot.posicao))).size === slots.length;

export const validateSplitSlots = (slots) => {
  if (!Array.isArray(slots) || slots.length < 2) return 'Selecione pelo menos duas posições para dividir o período.';
  if (!uniquePositions(slots)) return 'As posições da divisão não podem se repetir.';
  for (const slot of slots) {
    if (!Number.isInteger(Number(slot.posicao)) || Number(slot.posicao) < 1) return 'Informe uma posição válida para cada célula.';
    if (!isValidTime(slot.inicio)) return 'Informe um horário de início válido para todas as células.';
  }
  return null;
};

export const updatePeriodRecord = (period, changes) => ({
  ...period,
  ...changes,
  revisao: 'nao_revisado',
  origemEdicao: 'manual',
});

export const splitPeriodRecords = (period, slots) => {
  const error = validateSplitSlots(slots);
  if (error) throw new Error(error);
  return slots.map((slot, index) => ({
    ...period,
    id: `${period.id}-split-${Number(slot.posicao)}`,
    posicao: Number(slot.posicao),
    inicio: slot.inicio,
    inicioPendente: false,
    revisao: 'nao_revisado',
    origemEdicao: 'manual',
    incertezas: index === 0 ? period.incertezas : [],
  }));
};

export const replacePeriodWithSplit = (periods, periodId, slots) => {
  const period = periods.find((candidate) => candidate.id === periodId);
  if (!period) throw new Error('Período não encontrado.');
  const occupied = new Set(periods.filter((candidate) => candidate.id !== periodId).map((candidate) => candidate.posicao).filter(Boolean));
  const split = splitPeriodRecords(period, slots);
  if (split.some((candidate) => occupied.has(candidate.posicao))) throw new Error('Uma das posições selecionadas já possui outro período.');
  return [...periods.filter((candidate) => candidate.id !== periodId), ...split]
    .sort((left, right) => (left.posicao || 999) - (right.posicao || 999) || left.inicio.localeCompare(right.inicio));
};
