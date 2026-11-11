import { describe, expect, it } from 'vitest';
import { parseDraft } from '../src/services/drafts.js';

describe('legacy draft migration', () => {
  it('accepts version 1 periods with fim and removes only the legacy field', () => {
    const payload = {
      version: 1,
      schedules: {
        'Informática::61 1': {
          curso: 'Informática', turma: '61 1', dias: {
            segunda: { situacao: 'com_aulas', periodos: [{ id: 'p1', inicio: '08:20', fim: '09:10', disciplina: 'Programação', professor: 'Rodrigo', sala: '' }], compartilhamento: null },
            terca: { situacao: 'sem_aulas', periodos: [], compartilhamento: null },
            quarta: { situacao: 'sem_aulas', periodos: [], compartilhamento: null },
            quinta: { situacao: 'sem_aulas', periodos: [], compartilhamento: null },
            sexta: { situacao: 'sem_aulas', periodos: [], compartilhamento: null },
          },
        },
      },
    };
    const migrated = parseDraft(JSON.stringify(payload));
    expect(migrated.version).toBe(3);
    expect(migrated.sharing.pairDecisions).toEqual({});
    expect(migrated.schedules['Informática::61 1'].dias.segunda.periodos[0]).not.toHaveProperty('fim');
    expect(migrated.schedules['Informática::61 1'].dias.segunda.periodos[0].disciplina).toBe('Programação');
  });
});
