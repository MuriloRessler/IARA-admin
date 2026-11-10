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
