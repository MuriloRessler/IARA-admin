import { SCHOOL_SCHEDULE_RULES } from './schedule-rules.js';

const DAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta'];

const PAIR_DEFINITIONS = [
  ['Eletrônica', '11A', '11B'], ['Eletrônica', '12A', '12B'], ['Eletrônica', '13A', '13B'],
  ['Eletrotécnica', '21A', '21B'], ['Eletrotécnica', '22 1', '22 2'], ['Eletrotécnica', '23A', '23B'],
  ['Mecânica', '31 1', '31 2'], ['Mecânica', '32A', '32B'], ['Mecânica', '33A', '33B'],
  ['Design de Móveis', '41A', '41B'], ['Design de Móveis', '42 1', '42 2'], ['Design de Móveis', '43A', '43B'],
  ['Móveis', '51A', '51B'], ['Móveis', '52A', '52B'], ['Móveis', '53A', '53B'],
  ['Informática', '61 1', '61 2'], ['Informática', '62 1', '62 2'], ['Informática', '63 1', '63 2'],
  ['Química', '71A', '71B'], ['Química', '72A', '72B'], ['Química', '73A', '73B'],
  ['Meio Ambiente', '81A', '81B'], ['Meio Ambiente', '82A', '82B'], ['Meio Ambiente', '83A', '83B'],
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

const PERIOD_STARTS = SCHOOL_SCHEDULE_RULES.referenceProfiles.informaticaReference.starts;
const MORNING_PERIOD_COUNT = Math.ceil(PERIOD_STARTS.length / 2);
const TURN_DEFINITIONS = [
  { key: 'manha', label: 'Manhã', positions: Array.from({ length: MORNING_PERIOD_COUNT }, (_item, index) => index + 1) },
  { key: 'tarde', label: 'Tarde', positions: Array.from({ length: PERIOD_STARTS.length - MORNING_PERIOD_COUNT }, (_item, index) => index + MORNING_PERIOD_COUNT + 1) },
];

const turnFor = (period) => {
  const position = Number(period?.posicao);
  const resolvedPosition = Number.isInteger(position) && position > 0
    ? position
    : PERIOD_STARTS.indexOf(period?.inicio) + 1;
  return TURN_DEFINITIONS.find((turn) => turn.positions.includes(resolvedPosition))?.key || null;
};

const hasOwnLesson = (period) => Boolean(period
  && period.compartilhamentoStatus !== 'automatico'
  && period.origemEdicao !== 'compartilhamento_automatico'
  && (period.estado !== 'vazio_documento' || period.manualOverride || period.compartilhamentoStatus === 'substituida' || period.origemEdicao === 'manual')
  && (period.disciplina?.trim() || period.professor?.trim() || period.textoOriginal?.trim()));

const hasVisibleLesson = (period) => Boolean(period
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

const isExplicitlyExcluded = (status) => ['rejeitada', 'substituida'].includes(status);

const createSuggestion = ({ target, source, dayKey, targetPeriod, sourcePeriod, pairId, previous }) => {
  const id = `sharing:${pairId}:${target.curso}:${target.turma}:${dayKey}:${identityOf(targetPeriod)}`;
  const status = isExplicitlyExcluded(previous?.status) ? previous.status : 'automatico';
  return {
    id,
    pairId,
    target: { ...target },
    source: { ...source },
    dayKey,
    posicao: targetPeriod.posicao ?? sourcePeriod.posicao ?? null,
    inicio: targetPeriod.inicio || sourcePeriod.inicio || '',
    sourceFingerprint: sourceFingerprint(sourcePeriod),
    sourcePeriodId: sourcePeriod.id || null,
    period: { ...sourcePeriod },
    status,
    manualOverride: status === 'substituida' || Boolean(previous?.manualOverride),
  };
};

const pairHasBothSchedules = (pair, schedules) => Boolean(
  schedules?.[scheduleKey(pair.first.curso, pair.first.turma)]
  && schedules?.[scheduleKey(pair.second.curso, pair.second.turma)],
);

const ownPeriodsFor = (day) => (day?.periodos || []).filter(hasOwnLesson);

const eligibleTurnsFor = (day) => {
  const ownPeriods = ownPeriodsFor(day);
  if (ownPeriods.length === 0) return new Set(TURN_DEFINITIONS.map((turn) => turn.key));
  if (ownPeriods.length >= 4) return new Set();
  return new Set(ownPeriods.map(turnFor).filter(Boolean));
};

const isAutomaticPeriod = (period) => period?.compartilhamentoStatus === 'automatico'
  || period?.origemEdicao === 'compartilhamento_automatico';

export const getAutomaticPairDecisions = ({ schedules = {}, sharing = createSharingState() }) => {
  const official = getPairCatalog()
    .filter((pair) => pairHasBothSchedules(pair, schedules))
    .map((pair) => ({ ...pair, status: 'automatico' }));
  const officialIds = new Set(official.map((pair) => pair.id));
  const conflicts = Object.values(sharing.pairDecisions || {})
    .filter((decision) => decision?.first && decision?.second)
    .filter((decision) => !officialIds.has(decision.id))
    .filter((decision) => {
      const sameCourse = decision.first.curso === decision.second.curso;
      const hasSchedules = schedules[scheduleKey(decision.first.curso, decision.first.turma)]
        && schedules[scheduleKey(decision.second.curso, decision.second.turma)];
      return sameCourse && hasSchedules;
    })
    .map((decision) => ({ ...decision, type: 'custom-partner' }));
  return { pairs: official, conflicts };
};

export const getSharingConflicts = (options) => getAutomaticPairDecisions(options).conflicts;

export const buildSharingSuggestions = ({ schedules, sharing = createSharingState() }) => {
  const suggestions = [];
  const previous = sharing.suggestions || {};
  const automaticPairs = getAutomaticPairDecisions({ schedules, sharing }).pairs;
  for (const pair of automaticPairs) {
    const directions = [[pair.first, pair.second], [pair.second, pair.first]];
    for (const [target, source] of directions) {
      const targetSchedule = schedules[scheduleKey(target.curso, target.turma)];
      const sourceSchedule = schedules[scheduleKey(source.curso, source.turma)];
      if (!targetSchedule || !sourceSchedule) continue;
      for (const dayKey of DAYS) {
        const targetDay = targetSchedule.dias[dayKey];
        const sourceDay = sourceSchedule.dias[dayKey];
        if (['sem_aulas', 'compartilhado'].includes(targetDay?.situacao)
          || ['sem_aulas', 'compartilhado'].includes(sourceDay?.situacao)) continue;
        const targetOwnPeriods = ownPeriodsFor(targetDay);
        if (targetOwnPeriods.length >= 4) continue;
        const eligibleTurns = eligibleTurnsFor(targetDay);
        const targetPeriods = indexPeriods(targetDay);
        const sourcePeriods = indexPeriods(sourceDay);
        for (const [identity, sourcePeriod] of sourcePeriods.entries()) {
          if (!hasOwnLesson(sourcePeriod)) continue;
          const targetPeriod = targetPeriods.get(identity) || {
            id: `empty:${target.curso}:${target.turma}:${dayKey}:${identity}`,
            posicao: sourcePeriod.posicao ?? null,
            inicio: sourcePeriod.inicio || '',
            estado: 'vazio_documento',
            disciplina: '',
            professor: '',
            sala: '',
          };
          if (hasOwnLesson(targetPeriod) || !eligibleTurns.has(turnFor(sourcePeriod))) continue;
          const id = `sharing:${pair.id}:${target.curso}:${target.turma}:${dayKey}:${identity}`;
          suggestions.push(createSuggestion({
            target,
            source,
            dayKey,
            targetPeriod,
            sourcePeriod,
            pairId: pair.id,
            previous: previous[id],
          }));
        }
      }
    }
  }
  return suggestions;
};

const isSuggestionVisible = (suggestion) => ['automatico', 'sugerida', 'confirmada'].includes(suggestion.status);

export const applySharingSuggestions = (schedules, suggestions = []) => {
  const activeSuggestionIds = new Set(suggestions.filter(isSuggestionVisible).map((suggestion) => suggestion.id));
  const result = Object.fromEntries(Object.entries(schedules).map(([key, schedule]) => [key, {
    ...schedule,
    dias: Object.fromEntries(Object.entries(schedule.dias).map(([dayKey, day]) => [dayKey, {
      ...day,
      periodos: day.periodos.filter((period) => !isAutomaticPeriod(period) || activeSuggestionIds.has(period.id)),
    }])),
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
      revisao: 'revisado',
      origemEdicao: 'compartilhamento_automatico',
      compartilhamentoStatus: 'automatico',
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
      periodos: [...periodos].sort((left, right) => (left.posicao || 99) - (right.posicao || 99)),
    };
  }
  return result;
};

export const getDayTurnSummaries = (day) => {
  const dayHasLessons = (day?.periodos || []).some(hasVisibleLesson);
  return TURN_DEFINITIONS.map((turn) => {
    const lessons = (day?.periodos || []).filter((period) => turnFor(period) === turn.key && hasVisibleLesson(period)).length;
    return {
      ...turn,
      lessons,
      status: lessons > 0 ? 'com_aulas' : dayHasLessons ? 'folga' : 'vazio',
    };
  });
};

export const summarizeSharing = ({ schedules, pairDecisions: _pairDecisions, suggestions = [] }) => {
  const automaticPairs = getPairCatalog().filter((pair) => pairHasBothSchedules(pair, schedules));
  return {
    turmasAnalisadas: Object.keys(schedules || {}).length,
    paresIdentificados: automaticPairs.length,
    paresAutomaticos: automaticPairs.length,
    paresConfirmados: automaticPairs.length,
    paresPendentes: getPairCatalog().length - automaticPairs.length,
    sugestoes: suggestions.filter((suggestion) => suggestion.status === 'automatico').length,
    aceitas: suggestions.filter((suggestion) => ['automatico', 'confirmada'].includes(suggestion.status)).length,
    rejeitadas: suggestions.filter((suggestion) => suggestion.status === 'rejeitada').length,
    substituidas: suggestions.filter((suggestion) => suggestion.status === 'substituida').length,
    periodosVazios: Object.values(schedules || {}).reduce((total, schedule) => total + Object.values(schedule.dias || {}).reduce((dayTotal, day) => dayTotal + day.periodos.filter((period) => period.estado === 'vazio_documento').length, 0), 0),
  };
};

export const suggestionIdentity = (suggestion) => suggestion.id;
export const pairIdentity = pairIdFor;
