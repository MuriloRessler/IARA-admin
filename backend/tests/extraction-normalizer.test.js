import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeExtraction } from '../src/services/extraction-normalizer.js';

const starts = ['07:30', '08:20', '09:10', '10:10', '11:00', '13:00', '13:50', '14:40', '15:40', '16:30'];
const position = (posicao, disciplina = 'Química', overrides = {}) => ({
  posicao,
  posicoesAssociadas: [],
  estado: 'reconhecido',
  inicio: starts[posicao - 1],
  fim: posicao === 5 ? '12:00' : posicao === 10 ? '17:20' : '08:10',
  disciplina,
  professor: 'Professor',
  sala: 'A1',
  pagina: 1,
  incertezas: [],
  ...overrides,
});

const baseClass = (positions, course = 'Informática', classCode = '61 1') => ({
  turma: classCode,
  curso: course,
  turmaAssociacao: { regiao: 'left', confianca: 'confiavel' },
  avisos: [],
  segunda: { situacaoDocumento: 'com_aulas', posicoes: positions, avisos: [] },
  terca: { situacaoDocumento: 'dia_em_branco', posicoes: [], avisos: [] },
  quarta: { situacaoDocumento: 'dia_em_branco', posicoes: [], avisos: [] },
  quinta: { situacaoDocumento: 'dia_em_branco', posicoes: [], avisos: [] },
  sexta: { situacaoDocumento: 'dia_em_branco', posicoes: [], avisos: [] },
});

test('normalizer applies confirmed shift endings without grouping repeated disciplines', () => {
  const result = normalizeExtraction({
    extracted: { paginasAnalisadas: 4, turmas: [baseClass(starts.map((_start, index) => position(index + 1)))], observacoes: [] },
    courseName: 'Informática',
    fileName: 'reference.pdf',
    pageCount: 4,
  });
  const periods = result.schedules['Informática::61 1'].dias.segunda.periodos;

  assert.equal(periods.length, 10);
  assert.equal(periods[4].fim, '11:45');
  assert.equal(periods[9].fim, '17:15');
  assert.equal(periods.filter((period) => period.disciplina === 'Química').length, 10);
  assert.equal(result.diagnostico.posicoesIdentificadas, 10);
  assert.equal(result.schedules['Informática::61 1'].dias.terca.situacao, 'pendente');
});

test('normalizer preserves empty and unreadable cells and audits omitted positions', () => {
  const positions = [
    position(1, null, { estado: 'vazio_documento', disciplina: null }),
    position(2, null, { estado: 'nao_reconhecido', disciplina: null, sala: null }),
    position(4, 'Matemática'),
    position(5, 'Matemática'),
    position(6, 'História'),
  ];
  const result = normalizeExtraction({
    extracted: { paginasAnalisadas: 4, turmas: [baseClass(positions)], observacoes: [] },
    courseName: 'Informática',
    fileName: 'reference.pdf',
    pageCount: 4,
  });
  const schedule = result.schedules['Informática::61 1'];

  assert.equal(schedule.dias.segunda.periodos.length, 5);
  assert.equal(schedule.dias.segunda.periodos[0].estado, 'vazio_documento');
  assert.equal(schedule.dias.segunda.periodos[1].estado, 'nao_reconhecido');
  assert.equal(schedule.diagnostico.dias.segunda.faltantes.length, 5);
  assert.equal(result.diagnostico.posicoesFaltantes, 45);
  assert.ok(result.warnings.some((message) => message.includes('posição')));
});

test('normalizer expands an explicitly associated visual block into independent configured positions', () => {
  const result = normalizeExtraction({
    extracted: { paginasAnalisadas: 4, turmas: [baseClass([
      position(2, 'Programação', { posicoesAssociadas: [2, 3, 4, 5], inicio: '08:20', fim: '11:00' }),
    ])], observacoes: [] },
    courseName: 'Informática',
    fileName: 'reference.pdf',
    pageCount: 4,
  });
  const periods = result.schedules['Informática::61 1'].dias.segunda.periodos;

  assert.deepEqual(periods.map((period) => [period.posicao, period.inicio, period.fim]), [
    [2, '08:20', '09:10'],
    [3, '09:10', '10:10'],
    [4, '10:10', '11:00'],
    [5, '11:00', '11:45'],
  ]);
  assert.equal(new Set(periods.map((period) => period.id)).size, 4);
  assert.ok(periods.every((period) => period.disciplina === 'Programação' && period.revisao === 'nao_revisado'));
});

test('normalizer keeps an associated block pending when no schedule profile is confirmed', () => {
  const result = normalizeExtraction({
    extracted: { paginasAnalisadas: 1, turmas: [baseClass([position(2, 'Programação', { posicoesAssociadas: [2, 3, 4, 5], inicio: '08:20', fim: '11:00' })], 'Eletrônica', '11A')], observacoes: [] },
    courseName: 'Eletrônica',
    fileName: 'other.pdf',
    pageCount: 1,
  });
  assert.equal(result.schedules['Eletrônica::11A'].dias.segunda.periodos.length, 1);
  assert.equal(result.schedules['Eletrônica::11A'].dias.segunda.avisos.some((item) => item.message.includes('não foi confirmado')), true);
});

test('normalizer does not split a long interval without structural evidence', () => {
  const result = normalizeExtraction({
    extracted: { paginasAnalisadas: 4, turmas: [baseClass([position(2, 'Programação', { inicio: '08:20', fim: '11:00' })])], observacoes: [] },
    courseName: 'Informática',
    fileName: 'reference.pdf',
    pageCount: 4,
  });
  const day = result.schedules['Informática::61 1'].dias.segunda;
  assert.equal(day.periodos.length, 1);
  assert.ok(day.avisos.some((item) => item.message.includes('Possível bloco')));
});
