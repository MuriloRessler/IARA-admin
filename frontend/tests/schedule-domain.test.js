import { describe, expect, it } from 'vitest';
import { courses, getCourse, totalClasses } from '../src/config/courses.js';
import { parseDraft, serializeDraft } from '../src/services/drafts.js';
import { formatScheduleText } from '../src/services/schedule-format.js';
import { createEmptySchedule, scheduleKey } from '../src/services/schedule-model.js';
import { validateSchedule } from '../src/services/schedule-validation.js';

const scheduleWithConfirmedDays = (course = 'Informática', classCode = '61 1') => {
  const schedule = createEmptySchedule(course, classCode);
  schedule.dias.segunda = {
    situacao: 'com_aulas',
    compartilhamento: null,
    periodos: [{ id: 'one', inicio: '07:30', fim: '08:20', disciplina: 'Matemática', professor: 'Ana', sala: 'A1' }],
  };
  ['terca', 'quarta', 'quinta', 'sexta'].forEach((day) => {
    schedule.dias[day] = { situacao: 'sem_aulas', compartilhamento: null, periodos: [] };
  });
  return schedule;
};

describe('catalog and schedule domain', () => {
  it('keeps the eight courses and exactly 49 class codes', () => {
    expect(courses).toHaveLength(8);
    expect(totalClasses).toBe(49);
    expect(getCourse('Design de Móveis').classes).toContain('42 1');
    expect(getCourse('Informática').classes).toContain('61 1');
  });

  it('validates and formats a complete weekly schedule', () => {
    const schedule = scheduleWithConfirmedDays();
    const schedules = { [scheduleKey(schedule.curso, schedule.turma)]: schedule };
    expect(validateSchedule(schedule, schedules).valid).toBe(true);
    const text = formatScheduleText(schedule, schedules);
    expect(text).toContain('TURMA: 61 1');
    expect(text).toContain('SEGUNDA-FEIRA');
    expect(text).toContain('07:30 - 08:20 - Matemática | Professor: Ana | Sala: A1');
    expect(text).toContain('SEM AULAS CONFIRMADAS');
  });

  it('blocks a schedule with pending days and overlapping periods', () => {
    const schedule = scheduleWithConfirmedDays();
    schedule.dias.segunda.periodos.push({ id: 'two', inicio: '08:00', fim: '09:00', disciplina: 'Física', professor: '', sala: '' });
    schedule.dias.terca = { situacao: 'pendente', compartilhamento: null, periodos: [] };
    const schedules = { [scheduleKey(schedule.curso, schedule.turma)]: schedule };
    const validation = validateSchedule(schedule, schedules);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes('sobreposição'))).toBe(true);
    expect(() => formatScheduleText(schedule, schedules)).toThrow('pendências');
  });

  it('blocks extracted schedules until every day is explicitly reviewed', () => {
    const schedule = scheduleWithConfirmedDays();
    schedule.dias.segunda.revisao = 'nao_revisado';
    const schedules = { [scheduleKey(schedule.curso, schedule.turma)]: schedule };
    const validation = validateSchedule(schedule, schedules);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.message.includes('marcado como revisado'))).toBe(true);
  });

  it('keeps repeated periods and document-empty positions in the text preview', () => {
    const schedule = scheduleWithConfirmedDays();
    schedule.dias.segunda.periodos = [
      { id: 'one', posicao: 1, estado: 'reconhecido', inicio: '13:00', fim: '13:50', disciplina: 'Química', professor: '', sala: '' },
      { id: 'two', posicao: 2, estado: 'reconhecido', inicio: '13:50', fim: '14:40', disciplina: 'Química', professor: '', sala: '' },
      { id: 'three', posicao: 3, estado: 'vazio_documento', inicio: '14:40', fim: '15:40', disciplina: '', professor: '', sala: '' },
    ];
    const schedules = { [scheduleKey(schedule.curso, schedule.turma)]: schedule };
    const text = formatScheduleText(schedule, schedules);
    expect(text.match(/Química/g)).toHaveLength(2);
    expect(text).toContain('CÉLULA VAZIA NO DOCUMENTO');
    expect(parseDraft(serializeDraft(schedules)).schedules[scheduleKey(schedule.curso, schedule.turma)].dias.segunda.periodos).toHaveLength(3);
  });

  it('resolves a confirmed shared day without duplicating periods', () => {
    const source = scheduleWithConfirmedDays('Informática', '61 1');
    const target = scheduleWithConfirmedDays('Informática', '61 2');
    target.dias.segunda = { situacao: 'compartilhado', periodos: [], compartilhamento: { curso: 'Informática', turma: '61 1' } };
    const schedules = {
      [scheduleKey(source.curso, source.turma)]: source,
      [scheduleKey(target.curso, target.turma)]: target,
    };
    expect(validateSchedule(target, schedules).valid).toBe(true);
    expect(formatScheduleText(target, schedules)).toContain('AULAS COMPARTILHADAS DE: 61 1');
  });

  it('rejects circular shared-day references', () => {
    const first = scheduleWithConfirmedDays('Informática', '61 1');
    const second = scheduleWithConfirmedDays('Informática', '61 2');
    first.dias.segunda = { situacao: 'compartilhado', periodos: [], compartilhamento: { curso: 'Informática', turma: '61 2' } };
    second.dias.segunda = { situacao: 'compartilhado', periodos: [], compartilhamento: { curso: 'Informática', turma: '61 1' } };
    const schedules = {
      [scheduleKey(first.curso, first.turma)]: first,
      [scheduleKey(second.curso, second.turma)]: second,
    };
    expect(validateSchedule(first, schedules).issues.some((issue) => issue.message.includes('circular'))).toBe(true);
  });

  it('round-trips drafts and rejects unsupported formats', () => {
    const schedule = scheduleWithConfirmedDays();
    const schedules = { [scheduleKey(schedule.curso, schedule.turma)]: schedule };
    const parsed = parseDraft(serializeDraft(schedules));
    expect(parsed.version).toBe(1);
    expect(parsed.schedules['Informática::61 1'].dias.segunda.periodos[0].disciplina).toBe('Matemática');
    expect(() => parseDraft('{"version":99,"schedules":{}}')).toThrow('versão não suportada');
    expect(() => parseDraft('{"version":1,"schedules":{"bad":{"curso":"X"}}}')).toThrow('Turma inválida');
  });
});
