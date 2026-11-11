const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const PAIR_DEFINITIONS = [
  ['Eletrônica', '11A', '11B'], ['Eletrônica', '12A', '12B'], ['Eletrônica', '13A', '13B'],
  ['Eletrotécnica', '21A', '21B'], ['Eletrotécnica', '23A', '23B'],
  ['Mecânica', '32A', '32B'], ['Mecânica', '33A', '33B'],
  ['Design de Móveis', '41A', '41B'], ['Design de Móveis', '43A', '43B'],
  ['Móveis', '51A', '51B'], ['Móveis', '52A', '52B'], ['Móveis', '53A', '53B'],
  ['Química', '71A', '71B'], ['Química', '72A', '72B'], ['Química', '73A', '73B'],
  ['Meio Ambiente', '81A', '81B'], ['Meio Ambiente', '82A', '82B'], ['Meio Ambiente', '83A', '83B'],
  ['Eletrotécnica', '22 1', '22 2'], ['Mecânica', '31 1', '31 2'],
  ['Design de Móveis', '42 1', '42 2'], ['Informática', '61 1', '61 2'],
  ['Informática', '62 1', '62 2'], ['Informática', '63 1', '63 2'],
];

const scheduleKey = (course, classCode) => `${course}::${classCode}`;

const pairIdFor = (first, second) => [scheduleKey(first.curso, first.turma), scheduleKey(second.curso, second.turma)].sort().join('<->');

const clonePair = ([course, firstClass, secondClass]) => {
  const first = { curso: course, turma: firstClass };
  const second = { curso: course, turma: secondClass };
  return { id: pairIdFor(first, second), first, second, sameCourse: true };
};

export const getPairCatalog = () => PAIR_DEFINITIONS.map(clonePair);

export const createSharingState = (overrides = {}) => ({
  version: 1,
  pairDecisions: {},
  suggestions: {},
  ...overrides,
});

const identityOf = (period) => `${period?.posicao ?? ''}|${period?.inicio || ''}`;

const hasOwnLesson = (period) => Boolean(period
  && period.estado !== 'vazio_documento'
  && (period.disciplina?.trim() || period.professor?.trim() || period.textoOriginal?.trim()));

const sourceFingerprint = (period) => JSON.stringify({
  inicio: period?.inicio || '',
  posicao: period?.posicao ?? null,
  estado: period?.estado || '',
  disciplina: period?.disciplina || '',
  professor: period?.professor || '',
  sala: period?.sala || '',
});

const indexPeriods = (day) => new Map((day?.periodos || []).map((period) => [identityOf(period), period]));

const createSuggestion = ({ target, source, dayKey, targetPeriod, sourcePeriod, pairId, previous }) => {
  const id = `sharing:${pairId}:${target.curso}:${target.turma}:${dayKey}:${identityOf(targetPeriod)}`;
  const fingerprint = sourceFingerprint(sourcePeriod);
  const previousStillMatches = previous?.sourceFingerprint === fingerprint;
  return {
    id,
    pairId,
    target: { ...target },
    source: { ...source },
    dayKey,
    posicao: targetPeriod.posicao ?? sourcePeriod.posicao ?? null,
    inicio: targetPeriod.inicio || sourcePeriod.inicio || '',
    sourceFingerprint: fingerprint,
    sourcePeriodId: sourcePeriod.id || null,
    period: { ...sourcePeriod },
    status: previousStillMatches ? previous.status : 'sugerida',
    manualOverride: previousStillMatches ? Boolean(previous.manualOverride) : false,
  };
};

export const buildSharingSuggestions = ({ schedules, sharing = createSharingState() }) => {
  const suggestions = [];
  const previous = sharing.suggestions || {};
  for (const decision of Object.values(sharing.pairDecisions || {})) {
    if (decision.status !== 'confirmed' || !decision.first || !decision.second) continue;
    const directions = [[decision.first, decision.second], [decision.second, decision.first]];
    for (const [target, source] of directions) {
      const targetSchedule = schedules[scheduleKey(target.curso, target.turma)];
      const sourceSchedule = schedules[scheduleKey(source.curso, source.turma)];
      if (!targetSchedule || !sourceSchedule || target.curso !== source.curso) continue;
      for (const dayKey of DAYS) {
        const targetPeriods = indexPeriods(targetSchedule.dias[dayKey]);
        const sourcePeriods = indexPeriods(sourceSchedule.dias[dayKey]);
        for (const [identity, sourcePeriod] of sourcePeriods.entries()) {
          const targetPeriod = targetPeriods.get(identity);
          if (!targetPeriod || hasOwnLesson(targetPeriod) || !hasOwnLesson(sourcePeriod)) continue;
          const suggestion = createSuggestion({ target, source, dayKey, targetPeriod, sourcePeriod, pairId: decision.id || pairIdFor(decision.first, decision.second), previous: previous[`sharing:${decision.id || pairIdFor(decision.first, decision.second)}:${target.curso}:${target.turma}:${dayKey}:${identity}`] });
          suggestions.push(suggestion);
        }
      }
    }
  }
  return suggestions;
};

const isSuggestionVisible = (suggestion) => ['sugerida', 'confirmada'].includes(suggestion.status);

export const applySharingSuggestions = (schedules, suggestions = []) => {
  const result = Object.fromEntries(Object.entries(schedules).map(([key, schedule]) => [key, {
    ...schedule,
    dias: Object.fromEntries(Object.entries(schedule.dias).map(([dayKey, day]) => [dayKey, { ...day, periodos: [...day.periodos] }])),
  }]));

  for (const suggestion of suggestions.filter(isSuggestionVisible)) {
    const targetKey = scheduleKey(suggestion.target.curso, suggestion.target.turma);
    const schedule = result[targetKey];
    const day = schedule?.dias[suggestion.dayKey];
    if (!schedule || !day || ['sem_aulas', 'compartilhado'].includes(day.situacao)) continue;
    const targetIndex = day.periodos.findIndex((period) => identityOf(period) === `${suggestion.posicao ?? ''}|${suggestion.inicio || ''}`);
    const targetPeriod = targetIndex >= 0 ? day.periodos[targetIndex] : null;
    if (targetPeriod && hasOwnLesson(targetPeriod)) continue;
    const sharedPeriod = {
      ...suggestion.period,
      id: suggestion.id,
      posicao: suggestion.posicao,
      inicio: suggestion.inicio,
      revisao: suggestion.status === 'confirmada' ? 'revisado' : 'nao_revisado',
      origemEdicao: suggestion.status === 'confirmada' ? 'compartilhamento_confirmado' : 'compartilhamento_sugerido',
      compartilhamentoStatus: suggestion.status,
      origemCompartilhamento: {
        curso: suggestion.source.curso,
        turma: suggestion.source.turma,
        suggestionId: suggestion.id,
      },
    };
    const periodos = targetIndex >= 0
      ? day.periodos.map((period, index) => index === targetIndex ? sharedPeriod : period)
      : [...day.periodos, sharedPeriod];
    result[targetKey].dias[suggestion.dayKey] = {
      ...day,
      situacao: 'com_aulas',
      periodos,
    };
  }
  return result;
};

export const summarizeSharing = ({ schedules, pairDecisions, suggestions }) => ({
  turmasAnalisadas: Object.keys(schedules || {}).length,
  paresIdentificados: getPairCatalog().filter((pair) => schedules?.[scheduleKey(pair.first.curso, pair.first.turma)] && schedules?.[scheduleKey(pair.second.curso, pair.second.turma)]).length,
  paresConfirmados: Object.values(pairDecisions || {}).filter((decision) => decision.status === 'confirmed').length,
  paresPendentes: getPairCatalog().length - Object.values(pairDecisions || {}).filter((decision) => decision.status === 'confirmed').length,
  sugestoes: suggestions.filter((suggestion) => suggestion.status === 'sugerida').length,
  aceitas: suggestions.filter((suggestion) => suggestion.status === 'confirmada').length,
  rejeitadas: suggestions.filter((suggestion) => suggestion.status === 'rejeitada').length,
  periodosVazios: Object.values(schedules || {}).reduce((total, schedule) => total + Object.values(schedule.dias || {}).reduce((dayTotal, day) => dayTotal + day.periodos.filter((period) => period.estado === 'vazio_documento').length, 0), 0),
});

export const suggestionIdentity = (suggestion) => suggestion.id;
export const pairIdentity = pairIdFor;
