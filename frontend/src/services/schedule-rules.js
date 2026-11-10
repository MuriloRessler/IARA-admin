export { SCHOOL_SCHEDULE_RULES } from '../../../shared/schedule-rules.js';
import { SCHOOL_SCHEDULE_RULES } from '../../../shared/schedule-rules.js';

const normalizeCourse = (value) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim() || '';
const getProfile = (courseName) => Object.values(SCHOOL_SCHEDULE_RULES.referenceProfiles)
  .find((candidate) => normalizeCourse(candidate.course) === normalizeCourse(courseName));

export const getReferenceSlots = (courseName) => {
  const profile = getProfile(courseName);
  if (!profile) return [];
  return profile.starts.map((inicio, index) => ({ posicao: index + 1, inicio, fim: profile.terminalEnds[index + 1] || profile.starts[index + 1] || '' }));
};

export const getSplitCandidates = (period, courseName) => {
  const slots = getReferenceSlots(courseName);
  if (!slots.length) return [];
  const startIndex = period.posicao ? slots.findIndex((slot) => slot.posicao === period.posicao) : slots.findIndex((slot) => slot.inicio === period.inicio);
  if (startIndex < 0) return [];
  const isAfternoon = startIndex >= 5;
  const shiftEnd = isAfternoon ? 10 : 5;
  return slots.slice(startIndex, shiftEnd);
};
