import { courses } from '../config/courses.js';

export const DAYS = [
  { key: 'segunda', label: 'SEGUNDA-FEIRA' },
  { key: 'terca', label: 'TERÇA-FEIRA' },
  { key: 'quarta', label: 'QUARTA-FEIRA' },
  { key: 'quinta', label: 'QUINTA-FEIRA' },
  { key: 'sexta', label: 'SEXTA-FEIRA' },
];

export const DAY_STATUSES = ['com_aulas', 'compartilhado', 'sem_aulas', 'pendente'];

export const scheduleKey = (course, classCode) => `${course}::${classCode}`;

let periodSequence = 0;
const nextPeriodId = () => {
  periodSequence += 1;
  return `period-${periodSequence}`;
};

export const createPeriod = () => ({
  id: nextPeriodId(),
  posicao: null,
  estado: 'reconhecido',
  inicio: '',
  disciplina: '',
  professor: '',
  sala: '',
  paginaFonte: null,
  incertezas: [],
  revisao: 'nao_revisado',
  origemEdicao: 'manual',
});

export const createEmptyDay = () => ({
  situacao: 'pendente',
  periodos: [],
  compartilhamento: null,
  revisao: 'revisado',
  avisos: [],
});

export const createEmptySchedule = (curso, turma) => ({
  curso,
  turma,
  origem: 'manual',
  revisao: 'revisado',
  avisos: [],
  dias: Object.fromEntries(DAYS.map(({ key }) => [key, createEmptyDay()])),
});

export const createScheduleBook = () => Object.fromEntries(
  courses.flatMap((course) => course.classes.map((classCode) => [
    scheduleKey(course.name, classCode),
    createEmptySchedule(course.name, classCode),
  ])),
);

export const getDayDefinition = (dayKey) => DAYS.find((day) => day.key === dayKey);

export const getSchedule = (schedules, course, classCode) => schedules[scheduleKey(course, classCode)];

export const getEffectiveDay = (schedules, currentKey, dayKey, visited = new Set()) => {
  const schedule = schedules[currentKey];
  if (!schedule) return { periods: [], error: 'Turma de origem não encontrada.' };

  const day = schedule.dias[dayKey];
  if (!day) return { periods: [], error: 'Dia da semana inválido.' };
  if (day.situacao !== 'compartilhado' || !day.compartilhamento) {
    return { periods: day.periodos, inheritedFrom: null };
  }

  if (visited.has(currentKey)) {
    return { periods: [], error: 'Referência circular entre turmas.' };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(currentKey);
  const sourceKey = scheduleKey(day.compartilhamento.curso, day.compartilhamento.turma);
  const resolved = getEffectiveDay(schedules, sourceKey, dayKey, nextVisited);
  return {
    ...resolved,
    inheritedFrom: day.compartilhamento,
  };
};
