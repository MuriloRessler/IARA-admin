// Layout geometry is expressed as page fractions so it can be reused at any PDF resolution.
export const LAYOUT_PROFILES = Object.freeze({
  informaticaUrânia: Object.freeze({
    id: 'informatica-urania-v1',
    course: 'Informática',
    startTimes: Object.freeze(['07:30', '08:20', '09:10', '10:10', '11:00', '13:00', '13:50', '14:40', '15:40', '16:30']),
    detection: Object.freeze({
      minHeaderConfidence: 0.72,
      minRowConfidence: 0.62,
      minCellConfidence: 0.62,
    }),
  }),
});

export const getLayoutProfile = (courseName) => Object.values(LAYOUT_PROFILES)
  .find((profile) => profile.course === courseName) || null;
