export const SCHOOL_SCHEDULE_RULES = Object.freeze({
  general: Object.freeze({
    requireExplicitUnknowns: true,
  }),
  referenceProfiles: Object.freeze({
    informaticaReference: Object.freeze({
      course: 'Informática',
      expectedPages: 4,
      expectedClasses: 7,
      starts: Object.freeze(['07:30', '08:20', '09:10', '10:10', '11:00', '13:00', '13:50', '14:40', '15:40', '16:30']),
    }),
  }),
});
