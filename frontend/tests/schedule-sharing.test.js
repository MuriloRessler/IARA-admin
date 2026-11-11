import { describe, expect, it } from 'vitest';
import { applySharingSuggestions, buildSharingSuggestions, createSharingState, getAutomaticPairDecisions, getPairCatalog } from '../../shared/schedule-sharing.js';
import { createEmptySchedule, scheduleKey } from '../src/services/schedule-model.js';
import { parseDraft, serializeDraft } from '../src/services/drafts.js';

const period = (position, discipline = '', overrides = {}) => ({
  id: `${position}-${discipline || 'empty'}`,
  posicao: position,
  inicio: ['07:30', '08:20', '09:10', '10:10', '11:00', '13:00', '13:50', '14:40', '15:40', '16:30'][position - 1],
  estado: discipline ? 'reconhecido' : 'vazio_documento',
  disciplina: discipline,
  professor: discipline ? 'Professor' : '',
  sala: '',
  revisao: 'nao_revisado',
  ...overrides,
});

const schedule = (classCode, filled = {}, course = 'Informática') => {
  const result = createEmptySchedule(course, classCode);
  result.dias.quinta = {
    situacao: 'com_aulas',
    periodos: Array.from({ length: 10 }, (_item, index) => period(index + 1, filled[index + 1] || '')),
    compartilhamento: null,
    revisao: 'nao_revisado',
    avisos: [],
  };
  return result;
};

const pairDecision = (first = '61 1', second = '61 2') => ({
  id: `Informática::${first}<->Informática::${second}`,
  status: 'confirmed',
  first: { curso: 'Informática', turma: first },
  second: { curso: 'Informática', turma: second },
});

describe('period-by-period schedule sharing', () => {
  it('contains the 24 official candidate pairs and leaves 61 3 unconfigured', () => {
    expect(getPairCatalog()).toHaveLength(24);
    expect(getPairCatalog().some((pair) => pair.first.turma === '61 3' || pair.second.turma === '61 3')).toBe(false);
  });

  it('recognizes every official pair as automatic when both schedules are imported', () => {
    const schedules = Object.fromEntries(getPairCatalog().flatMap((pair) => [pair.first, pair.second])
      .filter((entry, index, entries) => entries.findIndex((candidate) => scheduleKey(candidate.curso, candidate.turma) === scheduleKey(entry.curso, entry.turma)) === index)
      .map((entry) => {
        const value = schedule(entry.turma, { 1: `${entry.turma} aula` }, entry.curso);
        return [scheduleKey(entry.curso, entry.turma), value];
      }));
    expect(getAutomaticPairDecisions({ schedules }).pairs).toHaveLength(24);
  });

  it('complements both directions from original periods without grouping or duplication', () => {
    const first = schedule('61 1', { 1: 'Matemática', 2: 'Matemática', 3: 'Sites', 4: 'Sites', 5: 'Sites' });
    const second = schedule('61 2', { 6: 'Educação Física', 7: 'Modelagem', 8: 'Modelagem', 9: 'Modelagem', 10: 'Modelagem' });
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const sharing = { ...createSharingState(), pairDecisions: { [pairDecision().id]: pairDecision() } };
    const suggestions = buildSharingSuggestions({ schedules, sharing });
    expect(suggestions).toHaveLength(10);
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '61 1')).toHaveLength(5);
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '61 2')).toHaveLength(5);
    const consolidated = applySharingSuggestions(schedules, suggestions);
    expect(consolidated['Informática::61 1'].dias.quinta.periodos[5].compartilhamentoStatus).toBe('automatico');
    expect(consolidated['Informática::61 2'].dias.quinta.periodos[0].disciplina).toBe('Matemática');
    expect(applySharingSuggestions(consolidated, suggestions)['Informática::61 2'].dias.quinta.periodos).toHaveLength(10);
  });

  it('does not propose when both positions are empty or both have own lessons', () => {
    const first = schedule('61 1', { 1: 'Aula própria' });
    const second = schedule('61 2', { 1: 'Outra aula própria' });
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const sharing = { ...createSharingState(), pairDecisions: { [pairDecision().id]: pairDecision() } };
    const suggestions = buildSharingSuggestions({ schedules, sharing });
    expect(suggestions.some((suggestion) => suggestion.inicio === '07:30')).toBe(false);
  });

  it('preserves two own 72B lessons and proposes the other eight from 72A', () => {
    const source = schedule('72A', Object.fromEntries(Array.from({ length: 10 }, (_item, index) => [index + 1, `Química ${index + 1}`])), 'Química');
    const target = schedule('72B', { 1: 'Processos Industriais', 2: 'Processos Industriais' }, 'Química');
    const schedules = { [scheduleKey(source.curso, source.turma)]: source, [scheduleKey(target.curso, target.turma)]: target };
    const decision = { ...pairDecision('72A', '72B'), first: { curso: 'Química', turma: '72A' }, second: { curso: 'Química', turma: '72B' }, id: 'Química::72A<->Química::72B' };
    const suggestions = buildSharingSuggestions({ schedules, sharing: { ...createSharingState(), pairDecisions: { [decision.id]: decision } } });
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '72B')).toHaveLength(8);
    expect(suggestions.find((suggestion) => suggestion.target.turma === '72B' && suggestion.inicio === '07:30')).toBeUndefined();
  });

  it('complements a completely empty 11B day with only the ten original 11A lessons', () => {
    const source = schedule('11A', Object.fromEntries(Array.from({ length: 10 }, (_item, index) => [index + 1, `Eletrônica ${index + 1}`])), 'Eletrônica');
    const target = schedule('11B', {}, 'Eletrônica');
    const schedules = { [scheduleKey(source.curso, source.turma)]: source, [scheduleKey(target.curso, target.turma)]: target };
    const decision = { ...pairDecision('11A', '11B'), first: { curso: 'Eletrônica', turma: '11A' }, second: { curso: 'Eletrônica', turma: '11B' }, id: 'Eletrônica::11A<->Eletrônica::11B' };
    const suggestions = buildSharingSuggestions({ schedules, sharing: { ...createSharingState(), pairDecisions: { [decision.id]: decision } } });
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '11B')).toHaveLength(10);
  });

  it('does not invent the remaining five positions when the partner has only five lessons', () => {
    const source = schedule('11A', { 1: 'Manhã 1', 2: 'Manhã 2', 3: 'Manhã 3', 4: 'Manhã 4', 5: 'Manhã 5' }, 'Eletrônica');
    const target = schedule('11B', {}, 'Eletrônica');
    const schedules = { [scheduleKey(source.curso, source.turma)]: source, [scheduleKey(target.curso, target.turma)]: target };
    const decision = { ...pairDecision('11A', '11B'), first: { curso: 'Eletrônica', turma: '11A' }, second: { curso: 'Eletrônica', turma: '11B' }, id: 'Eletrônica::11A<->Eletrônica::11B' };
    const suggestions = buildSharingSuggestions({ schedules, sharing: { ...createSharingState(), pairDecisions: { [decision.id]: decision } } });
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '11B')).toHaveLength(5);
  });

  it('complements alternating morning and afternoon lessons in both 63 1 and 63 2', () => {
    const first = schedule('63 1', { 1: 'Matemática', 2: 'Matemática', 3: 'Criação de Sites', 4: 'Criação de Sites', 5: 'Criação de Sites' });
    const second = schedule('63 2', { 6: 'Educação Física', 7: 'Modelagem', 8: 'Modelagem', 9: 'Modelagem', 10: 'Modelagem' });
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const decision = pairDecision('63 1', '63 2');
    const suggestions = buildSharingSuggestions({ schedules, sharing: { ...createSharingState(), pairDecisions: { [decision.id]: decision } } });
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '63 1')).toHaveLength(5);
    expect(suggestions.filter((suggestion) => suggestion.target.turma === '63 2')).toHaveLength(5);
  });

  it('allows an explicit custom partner while preserving the no-auto-pair rule', () => {
    const first = schedule('61 3', { 1: 'Aula 61 3' });
    const second = schedule('61 1', { 1: '', 2: 'Aula 61 1' });
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const decision = pairDecision('61 3', '61 1');
    const withoutDecision = buildSharingSuggestions({ schedules, sharing: createSharingState() });
    expect(withoutDecision).toHaveLength(0);
    const sharing = { ...createSharingState(), pairDecisions: { [decision.id]: decision } };
    const suggestions = buildSharingSuggestions({ schedules, sharing });
    expect(suggestions.some((suggestion) => suggestion.target.turma === '61 1' && suggestion.inicio === '07:30')).toBe(false);
    expect(getAutomaticPairDecisions({ schedules, sharing }).conflicts).toHaveLength(1);
  });

  it('keeps an official pair automatic without any confirmation record', () => {
    const first = schedule('61 1', { 1: 'Aula 1' });
    const second = schedule('61 2', {});
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const suggestions = buildSharingSuggestions({ schedules });
    expect(suggestions).toHaveLength(1);
    expect(suggestions.every((suggestion) => suggestion.status === 'automatico')).toBe(true);
  });

  it('preserves an intentional removal and allows the same cell to be restored', () => {
    const first = schedule('11A', { 1: 'Eletrônica' }, 'Eletrônica');
    const second = schedule('11B', {}, 'Eletrônica');
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const initial = buildSharingSuggestions({ schedules });
    const rejected = { ...createSharingState(), suggestions: { [initial[0].id]: { ...initial[0], status: 'rejeitada' } } };
    const excluded = buildSharingSuggestions({ schedules, sharing: rejected });
    expect(excluded[0].status).toBe('rejeitada');
    expect(applySharingSuggestions(schedules, excluded)['Eletrônica::11B'].dias.quinta.periodos[0].disciplina).toBe('');
    const restored = buildSharingSuggestions({ schedules, sharing: { ...rejected, suggestions: { [initial[0].id]: { ...initial[0], status: 'automatico' } } } });
    expect(applySharingSuggestions(schedules, restored)['Eletrônica::11B'].dias.quinta.periodos[0].disciplina).toBe('Eletrônica');
  });

  it('updates an automatic complement when the original source changes', () => {
    const first = schedule('11A', { 1: 'Original' }, 'Eletrônica');
    const second = schedule('11B', {}, 'Eletrônica');
    const schedules = { [scheduleKey(first.curso, first.turma)]: first, [scheduleKey(second.curso, second.turma)]: second };
    const initial = buildSharingSuggestions({ schedules });
    const changedSource = schedule('11A', { 1: 'Atualizada' }, 'Eletrônica');
    const changedSchedules = { [scheduleKey(changedSource.curso, changedSource.turma)]: changedSource, [scheduleKey(second.curso, second.turma)]: second };
    const previous = initial.find((item) => item.target.turma === '11B');
    const next = buildSharingSuggestions({ schedules: changedSchedules, sharing: { ...createSharingState(), suggestions: { [previous.id]: previous } } });
    const target = next.find((suggestion) => suggestion.target.turma === '11B');
    expect(target.status).toBe('automatico');
    expect(target.period.disciplina).toBe('Atualizada');
  });

  it('round-trips confirmed pair decisions in draft version 3', () => {
    const first = schedule('61 1', { 1: 'Aula' });
    const schedules = { [scheduleKey(first.curso, first.turma)]: first };
    const decision = pairDecision();
    const sharing = { ...createSharingState(), pairDecisions: { [decision.id]: decision }, suggestions: { rejected: { id: 'rejected', status: 'rejeitada', target: decision.second, source: decision.first, period: period(1) } } };
    const parsed = parseDraft(serializeDraft(schedules, sharing));
    expect(parsed.version).toBe(3);
    expect(parsed.sharing.pairDecisions[decision.id].status).toBe('confirmed');
    expect(parsed.sharing.suggestions.rejected.status).toBe('rejeitada');
  });
});
