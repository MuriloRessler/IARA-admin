import { SCHOOL_SCHEDULE_RULES } from '../../../shared/schedule-rules.js';

export { SCHOOL_SCHEDULE_RULES } from '../../../shared/schedule-rules.js';

const normalizeText = (value) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim() || '';

const countKnownStarts = (extracted) => {
  const starts = new Set();
  for (const turma of extracted?.turmas || []) {
    for (const day of ['segunda', 'terca', 'quarta', 'quinta', 'sexta']) {
      for (const position of turma[day]?.posicoes || turma[day]?.periodos || []) {
        if (position.inicio) starts.add(position.inicio);
      }
    }
  }
  return starts;
};

export const detectScheduleProfile = ({ courseName, pageCount, extracted }) => {
  const profile = Object.values(SCHOOL_SCHEDULE_RULES.referenceProfiles).find((candidate) => {
    if (normalizeText(candidate.course) !== normalizeText(courseName)) return false;
    const matchedStarts = candidate.starts.filter((start) => countKnownStarts(extracted).has(start)).length;
    const hasStructuralBlock = (extracted?.turmas || []).some((turma) => ['segunda', 'terca', 'quarta', 'quinta', 'sexta']
      .some((day) => (turma[day]?.posicoes || turma[day]?.periodos || [])
        .some((position) => (position.posicoesAssociadas || []).length >= 3)));
    return matchedStarts >= 3 || hasStructuralBlock;
  });
  return profile || null;
};

export const getPositionStart = (profile, position) => profile?.starts?.[position - 1] || null;
