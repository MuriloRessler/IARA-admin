import { courses } from '../config/courses.js';
import { DAYS, DAY_STATUSES, getEffectiveDay, scheduleKey } from './schedule-model.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isValidTime = (value) => TIME_PATTERN.test(value || '');

export const timeToMinutes = (value) => {
  if (!isValidTime(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const validatePeriod = (period, index) => {
  const errors = [];
  if (!isValidTime(period.inicio)) errors.push(`Período ${index + 1}: informe um início válido (HH:MM).`);
  if (period.fim && !isValidTime(period.fim)) errors.push(`Período ${index + 1}: informe um término válido (HH:MM).`);
  if (period.fim && isValidTime(period.inicio) && timeToMinutes(period.fim) <= timeToMinutes(period.inicio)) {
    errors.push(`Período ${index + 1}: o término deve ser posterior ao início.`);
  }
  if (!period.disciplina?.trim()) errors.push(`Período ${index + 1}: informe a disciplina.`);
  return errors;
};

const validatePeriods = (periods) => {
  const errors = periods.flatMap((period, index) => validatePeriod(period, index));
  const ordered = periods
    .map((period, index) => ({ period, index, start: timeToMinutes(period.inicio), end: timeToMinutes(period.fim) || timeToMinutes(period.inicio) }))
    .filter(({ start }) => start !== null)
    .sort((left, right) => left.start - right.start);

  ordered.forEach((current, index) => {
    const previous = ordered[index - 1];
    if (previous && current.start < previous.end) {
      errors.push(`Períodos ${previous.index + 1} e ${current.index + 1}: há sobreposição de horários.`);
    }
    if (previous && current.start === previous.start) {
      errors.push(`Períodos ${previous.index + 1} e ${current.index + 1}: há horários duplicados.`);
    }
  });
  return errors;
};

export const validateDay = (day, schedules, currentKey, dayKey) => {
  if (!day || !DAY_STATUSES.includes(day.situacao)) return ['Situação do dia inválida.'];
  if (day.situacao === 'pendente') return ['Dia pendente de conferência.'];
  if (day.situacao === 'sem_aulas') return day.periodos.length ? ['Dia sem aulas não pode conter períodos.'] : [];

  if (day.situacao === 'compartilhado') {
    if (!day.compartilhamento) return ['Selecione a turma de origem do compartilhamento.'];
    if (day.periodos.length) return ['Dia compartilhado não pode conter períodos editáveis.'];
    const sourceKey = scheduleKey(day.compartilhamento.curso, day.compartilhamento.turma);
    if (sourceKey === currentKey) return ['A turma não pode compartilhar aulas consigo mesma.'];
    const sourceDay = schedules[sourceKey]?.dias[dayKey];
    if (!sourceDay || !['com_aulas', 'compartilhado'].includes(sourceDay.situacao)) {
      return ['A turma de origem precisa ter aulas confirmadas neste dia.'];
    }
    const effective = getEffectiveDay(schedules, sourceKey, dayKey);
    if (effective.error) return [effective.error];
    if (!effective.periods.length) return ['A turma de origem não possui períodos válidos neste dia.'];
    return [];
  }

  if (day.compartilhamento) return ['Dia com aulas não pode manter um compartilhamento.'];
  if (!day.periodos.length) return ['Dia sem períodos: confirme “sem aulas” ou selecione um compartilhamento.'];
  return validatePeriods(day.periodos);
};

export const validateSchedule = (schedule, schedules) => {
  if (!schedule) return { valid: false, issues: ['Turma não encontrada.'], pendingDays: 0, errorCount: 1 };
  const issues = [];
  DAYS.forEach(({ key, label }) => {
    validateDay(schedule.dias[key], schedules, scheduleKey(schedule.curso, schedule.turma), key)
      .forEach((message) => issues.push({ day: key, label, message }));
  });
  return {
    valid: issues.length === 0,
    issues,
    pendingDays: DAYS.filter(({ key }) => schedule.dias[key].situacao === 'pendente').length,
    errorCount: issues.length,
  };
};

export const getCourseClasses = (courseName) => courses.find((course) => course.name === courseName)?.classes || [];
