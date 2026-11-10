const normalizeText = (value) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim() || '';

export const SCHOOL_SCHEDULE_RULES = Object.freeze({
  confirmedShiftEnds: Object.freeze({ morning: '11:45', afternoon: '17:15' }),
  general: Object.freeze({
    inferEndFromNextStart: false,
    requireExplicitUnknowns: true,
  }),
  referenceProfiles: Object.freeze({
    informaticaReference: Object.freeze({
      course: 'Informática',
      expectedPages: 4,
      expectedClasses: 7,
      starts: Object.freeze(['07:30', '08:20', '09:10', '10:10', '11:00', '13:00', '13:50', '14:40', '15:40', '16:30']),
      terminalEnds: Object.freeze({ 5: '11:45', 10: '17:15' }),
    }),
  }),
});

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
    return matchedStarts >= 3;
  });
  return profile || null;
};

export const getTerminalEnd = (profile, position) => profile?.terminalEnds?.[position] || null;

export const getPositionStart = (profile, position) => profile?.starts?.[position - 1] || null;
