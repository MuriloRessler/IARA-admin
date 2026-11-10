import { DAYS, getEffectiveDay, scheduleKey } from './schedule-model.js';
import { validateSchedule } from './schedule-validation.js';

export class ScheduleFormatError extends Error {
  constructor(issues) {
    super('A grade possui pendências de conferência.');
    this.name = 'ScheduleFormatError';
    this.issues = issues;
  }
}

const formatPeriod = (period) => {
  if (period.estado === 'vazio_documento') return `POSIÇÃO ${period.posicao || '?'}: CÉLULA VAZIA NO DOCUMENTO`;
  const time = period.fim ? `${period.inicio} - ${period.fim}` : period.inicio;
  const details = [period.professor && `Professor: ${period.professor}`, period.sala && `Sala: ${period.sala}`]
    .filter(Boolean)
    .join(' | ');
  const source = period.paginaFonte ? ` | Página: ${period.paginaFonte}` : '';
  return `${time} - ${period.disciplina}${details ? ` | ${details}` : ''}${source}`;
};

export const formatScheduleText = (schedule, schedules) => {
  const validation = validateSchedule(schedule, schedules);
  if (!validation.valid) throw new ScheduleFormatError(validation.issues);

  const lines = [`TURMA: ${schedule.turma}`, '', `CURSO: ${schedule.curso}`];
  DAYS.forEach(({ key, label }) => {
    const day = schedule.dias[key];
    lines.push('', label);
    if (day.situacao === 'sem_aulas') {
      lines.push('SEM AULAS CONFIRMADAS');
      return;
    }
    const effective = getEffectiveDay(schedules, scheduleKey(schedule.curso, schedule.turma), key);
    if (day.situacao === 'compartilhado') {
      lines.push(`AULAS COMPARTILHADAS DE: ${day.compartilhamento.turma} (${day.compartilhamento.curso})`);
    }
    effective.periods
      .slice()
      .sort((left, right) => left.inicio.localeCompare(right.inicio))
      .forEach((period) => lines.push(formatPeriod(period)));
  });
  return lines.join('\n');
};
