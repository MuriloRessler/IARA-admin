import { getEffectiveDay, scheduleKey } from './schedule-model.js';
import { validateSchedule } from './schedule-validation.js';
import { formatScheduleText as formatSharedScheduleText } from '../../../shared/schedule-text.js';

export class ScheduleFormatError extends Error {
  constructor(issues) {
    super('A grade possui pendências de conferência.');
    this.name = 'ScheduleFormatError';
    this.issues = issues;
  }
}

export const formatScheduleText = (schedule, schedules) => {
  const validation = validateSchedule(schedule, schedules);
  if (!validation.valid) throw new ScheduleFormatError(validation.issues);
  return formatSharedScheduleText({
    schedule,
    resolveDay: (dayKey) => getEffectiveDay(schedules, scheduleKey(schedule.curso, schedule.turma), dayKey),
  });
};
